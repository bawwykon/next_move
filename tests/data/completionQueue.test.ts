import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  OUTBOX_KEY,
  bumpOutboxAttempts,
  enqueueCompletion,
  flushOutbox,
  readOutbox,
  removeOutboxRow,
} from '@/data/completionQueue';
import { ok, fail } from '@/data/repositories/repoResult';
import type { CompletionEvent, CompletionResult } from '@/domain/completion/types';

jest.mock('@react-native-async-storage/async-storage', () => {
  const state = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => state.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        state.delete(key);
      }),
      mergeItem: jest.fn(async () => {}),
      clear: jest.fn(async () => {
        state.clear();
      }),
      getAllKeys: jest.fn(async () => Array.from(state.keys())),
      multiGet: jest.fn(async () => []),
      multiSet: jest.fn(async () => {}),
      multiRemove: jest.fn(async () => {}),
      multiMerge: jest.fn(async () => {}),
      flushGetRequests: jest.fn(),
    },
  } as unknown as typeof AsyncStorage;
});

const event = (idem: string, day = '2026-07-06'): CompletionEvent => ({
  quest_id: 'quest-1',
  idempotency_key: idem,
  started_at: '2026-07-06T07:00:00.000Z',
  completed_at: '2026-07-06T07:08:00.000Z',
  day_key: day,
});

const resultFor = (idem: string): CompletionResult =>
  ({
    xp: { quest: 50, daily: 0, weekly: 0, streak: 0, total: 50 },
    level: { before: 1, after: 1, title: 'Beginner' },
    mastery: [],
    journey: { quests: 1, chapter_before: 1, chapter_after: 1, next_threshold: 10 },
    streak: { current: 1, longest: 1 },
    achievements: [],
    cosmetics: [],
  }) as unknown as CompletionResult;

// Zero-arg payload fixture (the result shape ignores the label argument).
const resultForPayload = (): CompletionResult => resultFor('any');

describe('completion outbox (AsyncStorage)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('enqueue appends a row keyed by the event idempotency key with attempts 0', async () => {
    await enqueueCompletion(event('a'));
    const rows = await readOutbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'a',
      event: event('a'),
      attempts: 0,
    });
    expect(typeof rows[0]!.createdAtMs).toBe('number');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(OUTBOX_KEY, expect.any(String));
  });

  it('preserves insertion order (oldest first) across multiple enqueues', async () => {
    await enqueueCompletion(event('a'));
    await enqueueCompletion(event('b'));
    await enqueueCompletion(event('c'));
    expect((await readOutbox()).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('reads an empty queue when nothing was written', async () => {
    await expect(readOutbox()).resolves.toEqual([]);
  });

  it('reads [] for corrupted JSON under the key', async () => {
    await AsyncStorage.setItem(OUTBOX_KEY, '{not json');
    await expect(readOutbox()).resolves.toEqual([]);
  });

  it('reads [] for a non-array shape under the key', async () => {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify({ event: {} }));
    await expect(readOutbox()).resolves.toEqual([]);
  });

  it('drops foreign rows individually but keeps valid ones in order', async () => {
    await AsyncStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify([
        { id: 'a', event: event('a'), createdAtMs: 1, attempts: 0 },
        { id: 'b', event: { quest_id: 42 }, createdAtMs: 1, attempts: 0 },
        { id: 'c', wrong: 'shape' },
        { id: 'd', event: event('d'), createdAtMs: 1, attempts: 0 },
      ]),
    );
    expect((await readOutbox()).map((row) => row.id)).toEqual(['a', 'd']);
  });

  it('removeOutboxRow deletes only that row', async () => {
    await enqueueCompletion(event('a'));
    await enqueueCompletion(event('b'));
    await removeOutboxRow('a');
    expect((await readOutbox()).map((row) => row.id)).toEqual(['b']);
  });

  it('bumpOutboxAttempts increments a row in place', async () => {
    await enqueueCompletion(event('a'));
    await bumpOutboxAttempts('a');
    await bumpOutboxAttempts('a');
    expect((await readOutbox())[0]!.attempts).toBe(2);
  });
});

describe('flushOutbox', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('blank queue: no submissions, no onSuccess', async () => {
    const submit = jest.fn();
    const onSuccess = jest.fn();
    await flushOutbox({ submit, onSuccess });
    expect(submit).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('success: submits in order, stores results in order, empties the outbox', async () => {
    await enqueueCompletion(event('a'));
    await enqueueCompletion(event('b'));

    const results = [
      ok<CompletionResult>(resultForPayload()),
      ok<CompletionResult>(resultForPayload()),
    ];
    const submit = jest.fn().mockResolvedValueOnce(results[0]).mockResolvedValueOnce(results[1]);
    const onSuccess = jest.fn();

    await flushOutbox({ submit, onSuccess });

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0]![0]).toMatchObject({ idempotency_key: 'a' });
    expect(submit.mock.calls[1]![0]!).toMatchObject({ idempotency_key: 'b' });
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(onSuccess.mock.calls[0]![0]!.id).toBe('a');
    expect(onSuccess.mock.calls[0]![1]).toEqual(results[0]!.data);
    expect(onSuccess.mock.calls[1]![0]!.id).toBe('b');
    expect(await readOutbox()).toEqual([]);
  });

  it('failure: leaves the row, increments attempts, and keeps delivering the rest', async () => {
    await enqueueCompletion(event('a'));
    await enqueueCompletion(event('b'));

    const submit = jest
      .fn()
      .mockResolvedValueOnce(fail<CompletionResult>('quest_invalid'))
      .mockResolvedValueOnce(ok(resultForPayload()));
    await flushOutbox({ submit });

    const rows = await readOutbox();
    expect(rows.map((row) => row.id)).toEqual(['a']);
    expect(rows[0]!.attempts).toBe(1);
    expect(rows[0]!.event).toEqual(event('a'));
  });

  it('retry replays the SAME event (same idempotency key) — no re-generated key', async () => {
    await enqueueCompletion(event('a'));

    // First flush fails; the row is kept.
    await flushOutbox({
      submit: jest.fn().mockResolvedValueOnce(fail<CompletionResult>('unknown')),
    });

    // Second flush succeeds; the retried event must be byte-identical.
    const seen: CompletionEvent[] = [];
    const submit = jest.fn(async (ev: CompletionEvent) => {
      seen.push(ev);
      return ok<CompletionResult>(resultForPayload());
    });
    await flushOutbox({ submit });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(event('a'));
    expect(await readOutbox()).toEqual([]);
  });

  it('single-in-flight: concurrent flush calls share one run (no double delivery)', async () => {
    await enqueueCompletion(event('a'));

    let releaseResolve!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });
    const submit = jest.fn(async () => {
      await gate;
      return ok<CompletionResult>(resultForPayload());
    });

    const first = flushOutbox({ submit });
    const second = flushOutbox({ submit });
    const third = flushOutbox({ submit });

    // Yield so all three callers reach the guard before we let the run go.
    await Promise.resolve();
    await Promise.resolve();

    releaseResolve();
    await Promise.all([first, second, third]);

    // Regardless of overlapping flushes, the event was delivered exactly once.
    expect(submit).toHaveBeenCalledTimes(1);
    expect(await readOutbox()).toEqual([]);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';

import { enqueueCompletion, readOutbox } from '@/data/completionQueue';
import { submitCompletion } from '@/data/repositories/completion';
import { useCompletionStore, type StoredCompletion } from '@/state/completionStore';
import { ok, fail } from '@/data/repositories/repoResult';
import type { CompletionResult } from '@/domain/completion/types';

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

jest.mock('@/data/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

jest.mock('@/data/repositories/completion', () => ({
  submitCompletion: jest.fn(),
}));

const mockedSubmit = submitCompletion as jest.MockedFunction<typeof submitCompletion>;

const event = (questId: string, idem: string) => ({
  quest_id: questId,
  idempotency_key: idem,
  started_at: '2026-07-06T07:00:00.000Z',
  completed_at: '2026-07-06T07:08:00.000Z',
  day_key: '2026-07-06',
});

const resultFor = (total: number): CompletionResult => ({
  xp: { quest: 50, daily: total - 50, weekly: 0, streak: 0, total },
  level: { before: 1, after: 1, title: 'Beginner' },
  mastery: [],
  journey: { quests: 1, chapter_before: 1, chapter_after: 1, next_threshold: 10 },
  streak: { current: 1, longest: 1 },
  achievements: [],
  cosmetics: [],
});

beforeEach(async () => {
  await AsyncStorage.clear();
  useCompletionStore.getState().reset();
  mockedSubmit.mockReset();
});

describe('completion store (outbox sync)', () => {
  it('starts empty and hydrated', async () => {
    await useCompletionStore.getState().hydrate();
    expect(useCompletionStore.getState().pendingCount).toBe(0);
    expect(useCompletionStore.getState().lastCompletion).toBeNull();
  });

  it('hydrate reflects a persisted outbox (survived a launch)', async () => {
    await enqueueCompletion(event('quest-1', 'a'));
    await useCompletionStore.getState().hydrate();
    expect(useCompletionStore.getState().pendingCount).toBe(1);
  });

  it('enqueue persists to the outbox and raises pendingCount', async () => {
    await useCompletionStore.getState().enqueue(event('quest-1', 'a'));
    expect(useCompletionStore.getState().pendingCount).toBe(1);
    expect(await enqueueCompletionBytes()).toContain('quest-1');
  });

  it('flush success: clears the outbox and stores the authoritative result', async () => {
    mockedSubmit.mockResolvedValue(ok(resultFor(125)));
    await useCompletionStore.getState().enqueue(event('quest-1', 'a'));

    await useCompletionStore.getState().flush();

    const stored = useCompletionStore.getState().lastCompletion as StoredCompletion;
    expect(stored.result).toEqual(resultFor(125));
    expect(stored.questId).toBe('quest-1');
    expect(useCompletionStore.getState().pendingCount).toBe(0);
    expect(await readOutbox()).toEqual([]);
  });

  it('flush failure: keeps the row and leaves the previous result untouched', async () => {
    mockedSubmit.mockResolvedValue(fail('unknown'));
    await useCompletionStore.getState().enqueue(event('quest-1', 'a'));

    await useCompletionStore.getState().flush();

    expect(useCompletionStore.getState().lastCompletion).toBeNull();
    expect(useCompletionStore.getState().pendingCount).toBe(1);
  });

  it('partial flush: a failed row stays pending, a later success still stores', async () => {
    mockedSubmit
      .mockResolvedValueOnce(fail('quest_invalid'))
      .mockResolvedValueOnce(ok(resultFor(50)));
    await useCompletionStore.getState().enqueue(event('quest-bad', 'a'));
    await useCompletionStore.getState().enqueue(event('quest-good', 'b'));

    await useCompletionStore.getState().flush();

    const stored = useCompletionStore.getState().lastCompletion as StoredCompletion;
    expect(stored.questId).toBe('quest-good');
    expect(stored.result.xp.total).toBe(50);
    expect(useCompletionStore.getState().pendingCount).toBe(1); // only the bad row remains
  });
});

const enqueueCompletionBytes = async () =>
  (await AsyncStorage.getItem('completion.outbox.v1')) ?? undefined;

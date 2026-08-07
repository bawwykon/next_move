import {
  buildCompletionEvent,
  newIdempotencyKey,
  type BuildCompletionInput,
} from '@/domain/completion/buildEvent';
import { dayKey } from '@/domain/streak/dayKey';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const base = (overrides: Partial<BuildCompletionInput> = {}): BuildCompletionInput => ({
  questId: 'quest-123',
  startedAtEpochMs: 1_750_000_000_000,
  completedAtEpochMs: 1_750_000_480_000,
  idempotencyKey: '11111111-2222-4333-8444-555555555555',
  today: new Date(2026, 6, 6, 10, 30),
  ...overrides,
});

describe('buildCompletionEvent', () => {
  it('emits all five server fields with ISO-8601 UTC timestamps', () => {
    const event = buildCompletionEvent(base());

    expect(event.quest_id).toBe('quest-123');
    expect(event.idempotency_key).toBe('11111111-2222-4333-8444-555555555555');
    expect(event.started_at).toBe(new Date(1_750_000_000_000).toISOString());
    expect(event.completed_at).toBe(new Date(1_750_000_480_000).toISOString());
    expect(event.started_at).toMatch(/^.*Z$/);
    expect(event.completed_at).toMatch(/^.*Z$/);
  });

  it('derives day_key from the injected local date via domain dayKey (Ref 05 tz)', () => {
    const event = buildCompletionEvent(base());
    // The injected Date is constructed in local time, so the expected key is
    // timezone-independent regardless of where the suite runs.
    expect(event.day_key).toBe(dayKey(new Date(2026, 6, 6, 10, 30)));
    expect(event.day_key).toBe('2026-07-06');
  });

  it('day_key follows the injected date, not the wall clock', () => {
    const event = buildCompletionEvent(base({ today: new Date(2026, 11, 31, 23, 59) }));
    expect(event.day_key).toBe('2026-12-31');
  });

  it('is idempotency-stable per event: identical inputs produce identical events', () => {
    const a = buildCompletionEvent(base());
    const b = buildCompletionEvent(base());
    expect(b).toEqual(a);
  });

  it('passes the generated idempotency key through unchanged (retry = same key)', () => {
    const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const event = buildCompletionEvent(base({ idempotencyKey: key }));
    expect(event.idempotency_key).toBe(key);
  });

  it('rejects an empty quest id', () => {
    expect(() => buildCompletionEvent(base({ questId: '  ' }))).toThrow(/quest id/);
  });

  it('rejects non-finite or non-positive timestamps', () => {
    expect(() => buildCompletionEvent(base({ startedAtEpochMs: NaN }))).toThrow(/positive finite/);
    expect(() => buildCompletionEvent(base({ completedAtEpochMs: 0 }))).toThrow(/positive finite/);
  });

  it('rejects a completion before its start', () => {
    expect(() => buildCompletionEvent(base({ completedAtEpochMs: 1_749_999_999_000 }))).toThrow(
      /cannot precede/,
    );
  });

  it('rejects a non-UUID idempotency key', () => {
    expect(() => buildCompletionEvent(base({ idempotencyKey: 'not-a-uuid' }))).toThrow(/UUID/);
  });

  it('rejects an invalid local date', () => {
    expect(() => buildCompletionEvent(base({ today: new Date(NaN) }))).toThrow(/local date/);
  });
});

describe('newIdempotencyKey', () => {
  it('produces UUID v4 keys accepted by buildCompletionEvent', () => {
    for (let i = 0; i < 25; i += 1) {
      const key = newIdempotencyKey();
      expect(key).toMatch(UUID_V4_RE);
      expect(() => buildCompletionEvent(base({ idempotencyKey: key }))).not.toThrow();
    }
  });

  it('is unique across many calls (one key per event, generated once)', () => {
    const keys = new Set(Array.from({ length: 250 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(250);
  });
});

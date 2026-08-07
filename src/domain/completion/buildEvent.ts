/**
 * S5-05 — pure completion-event builder (Ref 06 §complete_quest).
 *
 * The event is the single contract with the server: { quest_id,
 * idempotency_key, started_at, completed_at, day_key }. The idempotency key
 * is generated exactly once when the event is built and persisted with the
 * outbox row (S5-05), so a retried delivery replays the same key and the RPC's
 * stored-payload short-circuit keeps it a no-op (no double unlock).
 *
 * Timestamps are ISO-8601 UTC strings; the RPC casts them to timestamptz.
 * day_key is the client-local calendar date via domain/streak/dayKey — the
 * date is injected (like streak.ts, Ref 03 "no clocks inside"), so this stays
 * pure and timezone-deterministic in tests.
 */
import { dayKey, dayKeyToUtcMs } from '@/domain/streak/dayKey';
import type { CompletionEvent } from '@/domain/completion/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BuildCompletionInput {
  questId: string;
  startedAtEpochMs: number;
  completedAtEpochMs: number;
  /** Stable per event; generated once and replayed unchanged on retry. */
  idempotencyKey: string;
  /** Local calendar date whose day_key the event claims (Ref 05 tz). */
  today: Date;
}

export function buildCompletionEvent(input: BuildCompletionInput): CompletionEvent {
  if (input.questId.trim().length === 0) {
    throw new Error('A completion event needs a quest id.');
  }
  if (
    !Number.isFinite(input.startedAtEpochMs) ||
    input.startedAtEpochMs <= 0 ||
    !Number.isFinite(input.completedAtEpochMs) ||
    input.completedAtEpochMs <= 0
  ) {
    throw new Error('Completion timestamps must be positive finite epoch milliseconds.');
  }
  if (input.completedAtEpochMs < input.startedAtEpochMs) {
    throw new Error('completed_at cannot precede started_at.');
  }
  if (!UUID_RE.test(input.idempotencyKey)) {
    throw new Error('Idempotency key must be a UUID.');
  }
  if (!(input.today instanceof Date) || Number.isNaN(input.today.getTime())) {
    throw new Error('A local date is required to derive the day key.');
  }
  const key = dayKey(input.today);
  if (dayKeyToUtcMs(key) === null) {
    throw new Error(`Invalid calendar day: ${key}.`);
  }

  return {
    quest_id: input.questId.trim(),
    idempotency_key: input.idempotencyKey,
    started_at: new Date(input.startedAtEpochMs).toISOString(),
    completed_at: new Date(input.completedAtEpochMs).toISOString(),
    day_key: key,
  };
}

/**
 * A fresh UUID v4 idempotency key. Prefers the platform crypto API when it is
 * available (RandomSource.randomUUID); falls back to a self-seeded v4 so the
 * device still produces spec-conforming keys. Uniqueness is what matters for
 * idempotency — format is checked by buildCompletionEvent.
 */
export function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

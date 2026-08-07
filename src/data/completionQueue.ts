import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CompletionEvent, CompletionResult } from '@/domain/completion/types';
import type { RepoResult } from '@/data/repositories/repoResult';

// Versioned key — bumping the suffix invalidates stale outbox shapes.
export const OUTBOX_KEY = 'completion.outbox.v1';

export interface OutboxRow {
  id: string;
  event: CompletionEvent;
  createdAtMs: number;
  attempts: number;
}

export type CompletionSubmit = (event: CompletionEvent) => Promise<RepoResult<CompletionResult>>;

export interface FlushOutboxDeps {
  submit: CompletionSubmit;
  /** Called after a row's event is accepted by the server (in queue order). */
  onSuccess?: (row: OutboxRow, result: CompletionResult) => void | Promise<void>;
}

function isRow(value: unknown): value is OutboxRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.createdAtMs !== 'number' ||
    !Number.isFinite(record.createdAtMs) ||
    typeof record.attempts !== 'number' ||
    !Number.isInteger(record.attempts) ||
    record.attempts < 0 ||
    typeof record.event !== 'object' ||
    record.event === null
  ) {
    return false;
  }
  const event = record.event as Record<string, unknown>;
  return (
    typeof event.quest_id === 'string' &&
    typeof event.idempotency_key === 'string' &&
    typeof event.started_at === 'string' &&
    typeof event.completed_at === 'string' &&
    typeof event.day_key === 'string'
  );
}

/** Append a completion event to the end of the outbox. Never throws. */
export async function enqueueCompletion(event: CompletionEvent): Promise<void> {
  try {
    const rows = await readRows();
    rows.push({
      id: event.idempotency_key,
      event,
      createdAtMs: Date.now(),
      attempts: 0,
    });
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(rows));
  } catch {
    // A failed persist must never crash the completion flow; the event is lost
    // (the workout already finished), the board simply shows no pending marker.
  }
}

/**
 * Order-preserving snapshot of the outbox (oldest first). Corruption-tolerant:
 * unparsable storage reads as an empty queue, foreign/invalid rows are dropped
 * individually so the rest still syncs. Never throws.
 */
export async function readOutbox(): Promise<OutboxRow[]> {
  try {
    return await readRows();
  } catch {
    return [];
  }
}

/** Remove one row (by its id = the event's idempotency key). Never throws. */
export async function removeOutboxRow(id: string): Promise<void> {
  try {
    const rows = await readRows();
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(rows.filter((row) => row.id !== id)));
  } catch {
    // Best-effort; a stale row replays as an idempotent no-op on the next flush.
  }
}

/** Increment attempts on a queued row (in place). Never throws. */
export async function bumpOutboxAttempts(id: string): Promise<void> {
  try {
    const rows = await readRows();
    await AsyncStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify(
        rows.map((row) => (row.id === id ? { ...row, attempts: row.attempts + 1 } : row)),
      ),
    );
  } catch {
    // Best-effort: the row is kept with its previous attempts count.
  }
}

/**
 * Single-in-flight flush. Submits queued events oldest-first; each success
 * stores the authoritative result (onSuccess) and removes the row, each
 * failure leaves the row with attempts+1 for a later retry (the same
 * idempotency key replays as a server no-op). Concurrent calls share the
 * active run, so one flush never overlaps another.
 */
let inFlightFlush: Promise<void> | null = null;

export function flushOutbox(deps: FlushOutboxDeps): Promise<void> {
  if (inFlightFlush) {
    return inFlightFlush;
  }
  inFlightFlush = runFlush(deps).finally(() => {
    inFlightFlush = null;
  });
  return inFlightFlush;
}

async function runFlush(deps: FlushOutboxDeps): Promise<void> {
  const rows = await readOutbox();
  for (const row of rows) {
    const result = await deps.submit(row.event);
    if (result.error || result.data === null) {
      await bumpOutboxAttempts(row.id);
      continue;
    }
    if (deps.onSuccess) {
      await deps.onSuccess(row, result.data);
    }
    await removeOutboxRow(row.id);
  }
}

async function readRows(): Promise<OutboxRow[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  if (!raw) {
    return [];
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isRow);
}

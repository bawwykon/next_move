import { buildCompletionEvent, newIdempotencyKey } from '@/domain/completion/buildEvent';
import { useCompletionStore } from '@/state/completionStore';
import { useWorkoutStore } from '@/state/workoutStore';

/**
 * S5-05 — persist a finished workout as a completion event.
 *
 * The event is built from the stored checkpoint start instant and an
 * idempotency key generated once here (persisted with the outbox row), then
 * written to the AsyncStorage outbox BEFORE the caller navigates — so a kill
 * between enqueue and flush leaves a resumable event for the next foreground
 * flush (FR-TIMER-7). The network flush is fire-and-forget: navigation never
 * waits on the server, and a failed delivery retries on the next flush.
 */
export async function finishQuest(options: {
  questId: string;
  startedAtEpochMs: number;
}): Promise<void> {
  const event = buildCompletionEvent({
    questId: options.questId,
    startedAtEpochMs: options.startedAtEpochMs,
    completedAtEpochMs: Date.now(),
    idempotencyKey: newIdempotencyKey(),
    today: new Date(),
  });

  await useCompletionStore.getState().enqueue(event);
  // Fire-and-forget: the flush is single-in-flight and retry-safe, the outbox
  // survives a missed sync, and the board focus / next foreground picks it up.
  void useCompletionStore.getState().flush();
  try {
    await useWorkoutStore.getState().clearWorkout();
  } catch {
    // A stale checkpoint is harmless — the next run overwrites it.
  }
}

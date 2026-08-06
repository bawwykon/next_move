import type { WorkoutCheckpoint } from '@/data/checkpoint';
import { buildWorkout, isComplete, type WorkoutSegment } from '@/domain/timer/workoutEngine';

export type ForegroundDecision = 'complete' | 'resume' | 'none';

/**
 * Ref 08 §9 / EC-2 — decide what a foreground return means for a checkpoint:
 * - 'complete' when the wall clock reached the end (boundary-inclusive) —
 *   the run is done, no partial XP, hand off to victory;
 * - 'resume' when the run is still live — render continues from the stored
 *   startedAtEpochMs, so remaining time stays correct (FR-TIMER-5);
 * - 'none' without a checkpoint, before the start instant, or when the
 *   segments can no longer be rebuilt.
 */
export function decideOnForeground(
  checkpoint: WorkoutCheckpoint | null,
  nowMs: number,
  segments: readonly WorkoutSegment[],
): ForegroundDecision {
  if (!checkpoint) {
    return 'none';
  }
  if (nowMs < checkpoint.startedAtEpochMs) {
    return 'none';
  }
  let workout;
  try {
    workout = buildWorkout(segments, checkpoint.startedAtEpochMs);
  } catch {
    return 'none';
  }
  return isComplete(workout, nowMs) ? 'complete' : 'resume';
}

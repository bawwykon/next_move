export const COUNTDOWN_DURATION_MS = 3000;

export type WorkoutSegmentKind = 'warmup' | 'work' | 'rest' | 'cooldown';

export interface WorkoutSegment {
  kind: WorkoutSegmentKind;
  durationSec: number;
}

export interface Workout {
  segments: WorkoutSegment[];
  startedAtEpochMs: number;
  totalDurationSec: number;
}

const KINDS: readonly WorkoutSegmentKind[] = ['warmup', 'work', 'rest', 'cooldown'];

/**
 * Ref 08 §9 — validates the segment list and freezes the absolute timeline.
 * `totalDurationSec` is the segment sum; everything else derives from
 * `startedAtEpochMs`, so the engine never mutates and never reads a clock.
 */
export function buildWorkout(
  segments: readonly WorkoutSegment[],
  startedAtEpochMs: number,
): Workout {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('A workout needs at least one segment.');
  }
  for (const segment of segments) {
    if (!KINDS.includes(segment.kind)) {
      throw new Error(`Unknown segment kind: ${String(segment.kind)}`);
    }
    if (!Number.isInteger(segment.durationSec) || segment.durationSec <= 0) {
      throw new Error(
        `Segment duration must be a positive whole number of seconds, got ${String(segment.durationSec)}.`,
      );
    }
  }
  if (!Number.isFinite(startedAtEpochMs) || startedAtEpochMs <= 0) {
    throw new Error('A workout needs a positive epoch start timestamp.');
  }
  const totalDurationSec = segments.reduce((sum, segment) => sum + segment.durationSec, 0);
  return {
    segments: segments.map((segment) => ({ ...segment })),
    startedAtEpochMs,
    totalDurationSec,
  };
}

function segmentCumulativeEndMs(workout: Workout, index: number): number {
  let totalSec = 0;
  for (let i = 0; i <= index; i += 1) {
    totalSec += workout.segments[i]!.durationSec;
  }
  return totalSec * 1000;
}

/**
 * Ref 08 §9 — walk cumulative durations from `startedAt`. Null before the
 * workout starts and at/after the workout end (the final boundary belongs to
 * "complete", never to an overflow index). A timestamp exactly on a segment
 * boundary belongs to the next segment.
 */
export function segmentIndexAt(workout: Workout, nowMs: number): number | null {
  const elapsedMs = nowMs - workout.startedAtEpochMs;
  if (elapsedMs < 0) {
    return null;
  }
  if (elapsedMs >= workout.totalDurationSec * 1000) {
    return null;
  }
  let cumulativeMs = 0;
  for (let i = 0; i < workout.segments.length; i += 1) {
    cumulativeMs += workout.segments[i]!.durationSec * 1000;
    if (elapsedMs < cumulativeMs) {
      return i;
    }
  }
  return null;
}

/** Ref 08 §9 — cumulative end of the current segment − now (null when idle). */
export function remainingMs(workout: Workout, nowMs: number): number | null {
  const index = segmentIndexAt(workout, nowMs);
  if (index === null) {
    return null;
  }
  const elapsedMs = nowMs - workout.startedAtEpochMs;
  return segmentCumulativeEndMs(workout, index) - elapsedMs;
}

/** Whole-workout time left, clamped 0..total (pre-start = full total). */
export function totalRemainingMs(workout: Workout, nowMs: number): number {
  const totalMs = workout.totalDurationSec * 1000;
  const endMs = workout.startedAtEpochMs + totalMs;
  return Math.min(totalMs, Math.max(0, endMs - nowMs));
}

/** Ref 08 §9 / EC-2 — now ≥ start + total, boundary-inclusive. */
export function isComplete(workout: Workout, nowMs: number): boolean {
  return nowMs >= workout.startedAtEpochMs + workout.totalDurationSec * 1000;
}

/** Ref 08 §9 — the segment after the current one, or null (idle / last). */
export function nextUp(workout: Workout, nowMs: number): WorkoutSegment | null {
  const index = segmentIndexAt(workout, nowMs);
  if (index === null) {
    return null;
  }
  return workout.segments[index + 1] ?? null;
}

/**
 * FR-TIMER-3 — 3-2-1 roll-in for the first segment and for any segment that
 * follows a rest (work→rest and work→cooldown transitions never count down).
 * The countdown occupies the opening COUNTDOWN_DURATION_MS of that segment's
 * own window (the schedule itself is never shifted); past the window it is
 * null, and the segment's normal remaining time takes over.
 */
export function countdownMs(workout: Workout, nowMs: number): number | null {
  const index = segmentIndexAt(workout, nowMs);
  if (index === null) {
    return null;
  }
  if (index > 0 && workout.segments[index - 1]!.kind !== 'rest') {
    return null;
  }
  const segmentStartMs =
    workout.startedAtEpochMs + (index === 0 ? 0 : segmentCumulativeEndMs(workout, index - 1));
  const intoCountdownMs = nowMs - segmentStartMs;
  if (intoCountdownMs < 0 || intoCountdownMs >= COUNTDOWN_DURATION_MS) {
    return null;
  }
  return Math.floor((COUNTDOWN_DURATION_MS - intoCountdownMs - 1) / 1000) + 1;
}

/** Ref 08 §9 — whole-workout fraction for the progress bar, clamped 0..1. */
export function progress(workout: Workout, nowMs: number): number {
  const totalMs = workout.totalDurationSec * 1000;
  const fraction = (nowMs - workout.startedAtEpochMs) / totalMs;
  return Math.min(1, Math.max(0, fraction));
}

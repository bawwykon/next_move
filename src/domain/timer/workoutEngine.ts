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
 * Countdown pre-phases (AT-01E) extend the schedule — they are NOT carved out
 * of a segment's window: a segment with a 3-2-1 roll-in gets its full
 * configured duration AFTER the countdown ends.
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

/** FR-TIMER-3 / AT-01E / AT-01K — every non-rest segment opens with a 3-2-1
 * pre-phase (warmup, work, and cooldown alike); rest never counts down. */
function hasCountdown(workout: Workout, index: number): boolean {
  return workout.segments[index]!.kind !== 'rest';
}

/**
 * AT-01E — absolute ms offset of segment `index`'s start from
 * `startedAtEpochMs`, including every preceding segment's own countdown
 * pre-phase. The countdowns extend the schedule; the workout itself never
 * mutates and boundaries are pure arithmetic.
 */
function segmentStartMs(workout: Workout, index: number): number {
  let ms = 0;
  for (let i = 0; i < index; i += 1) {
    ms += workout.segments[i]!.durationSec * 1000;
    if (hasCountdown(workout, i)) {
      ms += COUNTDOWN_DURATION_MS;
    }
  }
  return ms;
}

/** Total wall time (segment durations + all countdown pre-phases), in ms. */
function totalScheduleMs(workout: Workout): number {
  return (
    workout.totalDurationSec * 1000 +
    workout.segments.reduce(
      (sum, _segment, index) => sum + (hasCountdown(workout, index) ? COUNTDOWN_DURATION_MS : 0),
      0,
    )
  );
}

/**
 * Ref 08 §9 — walk cumulative durations from `startedAt`. Null before the
 * workout starts and at/after the workout end (the final boundary belongs to
 * "complete", never to an overflow index). A timestamp exactly on a segment
 * boundary belongs to the next segment; a timestamp inside a countdown
 * pre-phase belongs to the segment it opens.
 */
export function segmentIndexAt(workout: Workout, nowMs: number): number | null {
  const elapsedMs = nowMs - workout.startedAtEpochMs;
  if (elapsedMs < 0) {
    return null;
  }
  if (elapsedMs >= totalScheduleMs(workout)) {
    return null;
  }
  for (let i = 0; i < workout.segments.length; i += 1) {
    const startMs = segmentStartMs(workout, i);
    const endMs =
      startMs +
      workout.segments[i]!.durationSec * 1000 +
      (hasCountdown(workout, i) ? COUNTDOWN_DURATION_MS : 0);
    if (elapsedMs < endMs) {
      return i;
    }
  }
  return null;
}

/**
 * Ref 08 §9 / AT-01E — ms left in the current segment's work window (null
 * when idle). The countdown pre-phase never consumes segment time: during the
 * roll-in, and the instant it ends, the full configured duration is ahead.
 */
export function remainingMs(workout: Workout, nowMs: number): number | null {
  const index = segmentIndexAt(workout, nowMs);
  if (index === null) {
    return null;
  }
  const startMs = segmentStartMs(workout, index);
  const workStartMs = startMs + (hasCountdown(workout, index) ? COUNTDOWN_DURATION_MS : 0);
  const endMs = workStartMs + workout.segments[index]!.durationSec * 1000;
  const elapsedMs = nowMs - workout.startedAtEpochMs;
  return Math.min(
    workout.segments[index]!.durationSec * 1000,
    endMs - Math.max(elapsedMs, workStartMs),
  );
}

/** Whole-workout time left (including countdown pre-phases), clamped 0..total. */
export function totalRemainingMs(workout: Workout, nowMs: number): number {
  const totalMs = totalScheduleMs(workout);
  const endMs = workout.startedAtEpochMs + totalMs;
  return Math.min(totalMs, Math.max(0, endMs - nowMs));
}

/** Ref 08 §9 / EC-2 — now ≥ start + total schedule, boundary-inclusive. */
export function isComplete(workout: Workout, nowMs: number): boolean {
  return nowMs >= workout.startedAtEpochMs + totalScheduleMs(workout);
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
 * FR-TIMER-3 / AT-01K — 3-2-1 roll-in opening every non-rest segment (rest
 * never counts down). The countdown occupies the first
 * COUNTDOWN_DURATION_MS of that segment's own pre-phase (the schedule itself
 * is never shifted and nothing is subtracted from the segment's duration);
 * past the window it is null and the segment's normal remaining time takes
 * over at the FULL configured value.
 */
export function countdownMs(workout: Workout, nowMs: number): number | null {
  const index = segmentIndexAt(workout, nowMs);
  if (index === null) {
    return null;
  }
  if (!hasCountdown(workout, index)) {
    return null;
  }
  const intoCountdownMs = nowMs - (workout.startedAtEpochMs + segmentStartMs(workout, index));
  if (intoCountdownMs < 0 || intoCountdownMs >= COUNTDOWN_DURATION_MS) {
    return null;
  }
  return Math.floor((COUNTDOWN_DURATION_MS - intoCountdownMs - 1) / 1000) + 1;
}

/** Ref 08 §9 — whole-workout fraction for the progress bar, clamped 0..1. */
export function progress(workout: Workout, nowMs: number): number {
  const fraction = (nowMs - workout.startedAtEpochMs) / totalScheduleMs(workout);
  return Math.min(1, Math.max(0, fraction));
}

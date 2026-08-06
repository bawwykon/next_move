import {
  buildWorkout,
  COUNTDOWN_DURATION_MS,
  countdownMs,
  isComplete,
  nextUp,
  progress,
  remainingMs,
  segmentIndexAt,
  totalRemainingMs,
  type Workout,
} from '@/domain/timer/workoutEngine';

// warmup 60 / work 120 / rest 30 / work 90 / cooldown 60 => 360s total
const SEGMENTS = [
  { kind: 'warmup', durationSec: 60 },
  { kind: 'work', durationSec: 120 },
  { kind: 'rest', durationSec: 30 },
  { kind: 'work', durationSec: 90 },
  { kind: 'cooldown', durationSec: 60 },
] as const;

const START = 1_000_000;
const workout: Workout = buildWorkout(SEGMENTS, START);
// cumulative ends (ms): 60s, 180s, 210s, 300s, 360s
const C = {
  w0End: START + 60_000,
  w1End: START + 180_000,
  w2End: START + 210_000,
  w3End: START + 300_000,
  end: START + 360_000,
};

describe('buildWorkout', () => {
  it('computes totalDurationSec as the segment sum', () => {
    expect(workout.totalDurationSec).toBe(360);
    expect(workout.startedAtEpochMs).toBe(START);
    expect(workout.segments).toHaveLength(5);
  });

  it('returns a defensive copy of the segment list', () => {
    const source = [{ kind: 'work', durationSec: 10 }] as const;
    const built = buildWorkout(source, START);
    expect(built.segments).not.toBe(source);
    (source[0] as { durationSec: number }).durationSec = 99;
    expect(built.segments[0]!.durationSec).toBe(10);
  });

  it('throws on empty input', () => {
    expect(() => buildWorkout([], START)).toThrow();
  });

  it('throws on zero, negative, or fractional durations', () => {
    expect(() => buildWorkout([{ kind: 'work', durationSec: 0 }], START)).toThrow();
    expect(() => buildWorkout([{ kind: 'work', durationSec: -5 }], START)).toThrow();
    expect(() => buildWorkout([{ kind: 'work', durationSec: 1.5 }], START)).toThrow();
  });

  it('throws on unknown kinds', () => {
    expect(() => buildWorkout([{ kind: 'sprint', durationSec: 10 }] as never, START)).toThrow();
  });

  it('throws on invalid start timestamps', () => {
    const one = [{ kind: 'work', durationSec: 10 }] as const;
    expect(() => buildWorkout(one, 0)).toThrow();
    expect(() => buildWorkout(one, -1000)).toThrow();
    expect(() => buildWorkout(one, Number.NaN)).toThrow();
    expect(() => buildWorkout(one, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('segmentIndexAt — boundary-exact walk', () => {
  it('is null before the workout starts', () => {
    expect(segmentIndexAt(workout, START - 1)).toBeNull();
    expect(segmentIndexAt(workout, START - 60_000)).toBeNull();
  });

  it('is 0 at the very start (t=0)', () => {
    expect(segmentIndexAt(workout, START)).toBe(0);
  });

  it('walks the middle of segments', () => {
    expect(segmentIndexAt(workout, START + 30_000)).toBe(0);
    expect(segmentIndexAt(workout, START + 120_000)).toBe(1);
    expect(segmentIndexAt(workout, START + 195_000)).toBe(2);
    expect(segmentIndexAt(workout, START + 255_000)).toBe(3);
    expect(segmentIndexAt(workout, START + 330_000)).toBe(4);
  });

  it('moves to the next segment exactly on a boundary', () => {
    expect(segmentIndexAt(workout, C.w0End)).toBe(1); // exactly 60s
    expect(segmentIndexAt(workout, C.w1End)).toBe(2); // exactly 180s
    expect(segmentIndexAt(workout, C.w2End)).toBe(3); // exactly 210s
    expect(segmentIndexAt(workout, C.w3End)).toBe(4); // exactly 300s
  });

  it('is null exactly at the workout end (never an overflow index)', () => {
    expect(segmentIndexAt(workout, C.end)).toBeNull();
    expect(segmentIndexAt(workout, C.end + 1)).toBeNull();
    expect(segmentIndexAt(workout, C.end + 60_000)).toBeNull();
  });
});

describe('remainingMs / totalRemainingMs', () => {
  it('gives the full segment at t=0', () => {
    expect(remainingMs(workout, START)).toBe(60_000);
    expect(totalRemainingMs(workout, START)).toBe(360_000);
  });

  it('counts down mid-segment', () => {
    expect(remainingMs(workout, START + 30_000)).toBe(30_000);
    expect(remainingMs(workout, START + 120_000)).toBe(60_000);
    expect(remainingMs(workout, START + 330_000)).toBe(30_000);
  });

  it('resets to the next full segment exactly on a boundary', () => {
    expect(remainingMs(workout, C.w0End)).toBe(120_000);
    expect(remainingMs(workout, C.w2End)).toBe(90_000);
  });

  it('is null / 0 at the workout end', () => {
    expect(remainingMs(workout, C.end)).toBeNull();
    expect(totalRemainingMs(workout, C.end)).toBe(0);
    expect(totalRemainingMs(workout, C.end + 5_000)).toBe(0);
  });

  it('is the full total before start', () => {
    expect(remainingMs(workout, START - 1000)).toBeNull();
    expect(totalRemainingMs(workout, START - 1000)).toBe(360_000);
  });
});

describe('isComplete — boundary-inclusive', () => {
  it('is false before the end', () => {
    expect(isComplete(workout, START)).toBe(false);
    expect(isComplete(workout, C.end - 1)).toBe(false);
  });

  it('is true exactly at start + total and after', () => {
    expect(isComplete(workout, C.end)).toBe(true);
    expect(isComplete(workout, C.end + 1)).toBe(true);
  });
});

describe('nextUp', () => {
  it('returns the next segment mid-run', () => {
    expect(nextUp(workout, START + 30_000)).toEqual({
      kind: 'work',
      durationSec: 120,
    });
    expect(nextUp(workout, START + 195_000)).toEqual({
      kind: 'work',
      durationSec: 90,
    });
  });

  it('is null on the last segment', () => {
    expect(nextUp(workout, START + 330_000)).toBeNull();
    expect(nextUp(workout, C.w3End)).toBeNull();
  });

  it('is null when idle (before start / after end)', () => {
    expect(nextUp(workout, START - 1000)).toBeNull();
    expect(nextUp(workout, C.end)).toBeNull();
  });
});

describe('countdownMs — FR-TIMER-3', () => {
  it('counts 3-2-1 at the start of the first segment', () => {
    expect(countdownMs(workout, START)).toBe(3);
    expect(countdownMs(workout, START + 1000)).toBe(2);
    expect(countdownMs(workout, START + 1999)).toBe(2);
    expect(countdownMs(workout, START + 2000)).toBe(1);
    expect(countdownMs(workout, START + 2999)).toBe(1);
  });

  it('is null once the first countdown window passes', () => {
    expect(countdownMs(workout, START + COUNTDOWN_DURATION_MS)).toBeNull();
    expect(countdownMs(workout, START + 30_000)).toBeNull();
  });

  it('never counts down for a rest following work', () => {
    expect(countdownMs(workout, C.w1End)).toBeNull();
    expect(countdownMs(workout, C.w1End + 1000)).toBeNull();
  });

  it('never counts down for a segment following work (work→cooldown)', () => {
    expect(countdownMs(workout, C.w3End)).toBeNull();
    expect(countdownMs(workout, C.w3End + 1000)).toBeNull();
  });

  it('counts 3-2-1 for the segment following a rest', () => {
    expect(countdownMs(workout, C.w2End)).toBe(3);
    expect(countdownMs(workout, C.w2End + 1000)).toBe(2);
    expect(countdownMs(workout, C.w2End + 2500)).toBe(1);
  });

  it('is null past the window after a rest', () => {
    expect(countdownMs(workout, C.w2End + COUNTDOWN_DURATION_MS)).toBeNull();
    expect(countdownMs(workout, C.w2End + 60_000)).toBeNull();
  });

  it('counts down for a cooldown that follows a rest (literal rule)', () => {
    const restTail = buildWorkout(
      [
        { kind: 'work', durationSec: 60 },
        { kind: 'rest', durationSec: 30 },
        { kind: 'cooldown', durationSec: 60 },
      ],
      START,
    );
    const cooldownStart = START + 90_000;
    expect(countdownMs(restTail, cooldownStart)).toBe(3);
    expect(countdownMs(restTail, cooldownStart + 1000)).toBe(2);
    expect(countdownMs(restTail, cooldownStart + COUNTDOWN_DURATION_MS)).toBeNull();
  });

  it('is null when idle', () => {
    expect(countdownMs(workout, START - 1000)).toBeNull();
    expect(countdownMs(workout, C.end)).toBeNull();
  });

  it('exported countdown constant is 3000ms', () => {
    expect(COUNTDOWN_DURATION_MS).toBe(3000);
  });
});

describe('progress — clamped 0..1, monotonic mid-run', () => {
  it('clamps to 0 before start and 1 at/after end', () => {
    expect(progress(workout, START - 10_000)).toBe(0);
    expect(progress(workout, START)).toBe(0);
    expect(progress(workout, C.end)).toBe(1);
    expect(progress(workout, C.end + 60_000)).toBe(1);
  });

  it('tracks the whole-workout fraction mid-run', () => {
    expect(progress(workout, START + 90_000)).toBeCloseTo(0.25, 6);
    expect(progress(workout, START + 180_000)).toBeCloseTo(0.5, 6);
    expect(progress(workout, START + 270_000)).toBeCloseTo(0.75, 6);
  });

  it('is monotonic across a run', () => {
    const samples = [START, START + 30_000, START + 120_000, START + 210_000, C.end - 1];
    for (let i = 1; i < samples.length; i += 1) {
      expect(progress(workout, samples[i]!)).toBeGreaterThanOrEqual(
        progress(workout, samples[i - 1]!),
      );
    }
  });
});

describe('background gaps — pure arithmetic resume (NFR-2 / EC-2)', () => {
  it('foregrounding 2h after start completes immediately', () => {
    const nowMs = START + 2 * 3600_000;
    expect(isComplete(workout, nowMs)).toBe(true);
    expect(segmentIndexAt(workout, nowMs)).toBeNull();
    expect(totalRemainingMs(workout, nowMs)).toBe(0);
    expect(countdownMs(workout, nowMs)).toBeNull();
    expect(progress(workout, nowMs)).toBe(1);
  });

  it('lands mid-segment exactly like a continuous run', () => {
    const long = buildWorkout([{ kind: 'work', durationSec: 1800 }], START);
    const nowMs = START + 900_000; // 15 min into a 30 min quest, "after a gap"
    expect(segmentIndexAt(long, nowMs)).toBe(0);
    expect(remainingMs(long, nowMs)).toBe(900_000);
    expect(isComplete(long, nowMs)).toBe(false);
  });

  it('boundary semantics survive a gap landing exactly on a boundary', () => {
    const nowMs = START + 180_000;
    expect(segmentIndexAt(workout, nowMs)).toBe(2);
    expect(remainingMs(workout, nowMs)).toBe(30_000);
  });
});

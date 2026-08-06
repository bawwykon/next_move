import { decideOnForeground } from '@/features/workout/decideOnForeground';
import type { WorkoutSegment } from '@/domain/timer/workoutEngine';

const SEGMENTS: WorkoutSegment[] = [
  { kind: 'warmup', durationSec: 10 },
  { kind: 'work', durationSec: 20 },
  { kind: 'cooldown', durationSec: 10 },
];
const STARTED_AT = 1_800_000_000_000;

describe('decideOnForeground', () => {
  it('returns none without a checkpoint', () => {
    expect(decideOnForeground(null, STARTED_AT + 5000, SEGMENTS)).toBe('none');
  });

  it('returns none before the start instant', () => {
    expect(
      decideOnForeground({ questId: 'q', startedAtEpochMs: STARTED_AT }, STARTED_AT - 1, SEGMENTS),
    ).toBe('none');
  });

  it('returns resume mid-run', () => {
    expect(
      decideOnForeground(
        { questId: 'q', startedAtEpochMs: STARTED_AT },
        STARTED_AT + 30_000,
        SEGMENTS,
      ),
    ).toBe('resume');
  });

  it('returns resume exactly at the last boundary', () => {
    expect(
      decideOnForeground(
        { questId: 'q', startedAtEpochMs: STARTED_AT },
        STARTED_AT + 39_999,
        SEGMENTS,
      ),
    ).toBe('resume');
  });

  it('returns complete exactly at the end boundary (EC-2, inclusive)', () => {
    expect(
      decideOnForeground(
        { questId: 'q', startedAtEpochMs: STARTED_AT },
        STARTED_AT + 40_000,
        SEGMENTS,
      ),
    ).toBe('complete');
  });

  it('returns complete well past the end', () => {
    expect(
      decideOnForeground(
        { questId: 'q', startedAtEpochMs: STARTED_AT },
        STARTED_AT + 4_000_000,
        SEGMENTS,
      ),
    ).toBe('complete');
  });

  it('returns none when the segments can no longer build a workout', () => {
    expect(
      decideOnForeground({ questId: 'q', startedAtEpochMs: STARTED_AT }, STARTED_AT + 1000, []),
    ).toBe('none');
  });
});

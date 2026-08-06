import { segmentKindLabel } from '@/features/questDetail/segmentKind';
import { formatSegmentDuration } from '@/features/questDetail/segmentDuration';
import { segmentsTotal } from '@/features/questDetail/segmentsTotal';

describe('segmentKindLabel', () => {
  it('maps every kind to a friendly capitalized label', () => {
    expect(segmentKindLabel('warmup')).toBe('Warm-up');
    expect(segmentKindLabel('work')).toBe('Work');
    expect(segmentKindLabel('rest')).toBe('Rest');
    expect(segmentKindLabel('cooldown')).toBe('Cooldown');
  });
});

describe('formatSegmentDuration', () => {
  it('formats sub-minute segments in seconds', () => {
    expect(formatSegmentDuration(30)).toBe('30s');
    expect(formatSegmentDuration(45)).toBe('45s');
    expect(formatSegmentDuration(59)).toBe('59s');
  });

  it('formats whole minutes', () => {
    expect(formatSegmentDuration(60)).toBe('1 min');
    expect(formatSegmentDuration(120)).toBe('2 min');
    expect(formatSegmentDuration(300)).toBe('5 min');
  });

  it('formats minutes plus seconds for >60s', () => {
    expect(formatSegmentDuration(90)).toBe('1 min 30s');
    expect(formatSegmentDuration(150)).toBe('2 min 30s');
    expect(formatSegmentDuration(135)).toBe('2 min 15s');
  });

  it('clamps negatives and rounds', () => {
    expect(formatSegmentDuration(0)).toBe('0s');
    expect(formatSegmentDuration(-5)).toBe('0s');
    expect(formatSegmentDuration(60.4)).toBe('1 min');
  });
});

describe('segmentsTotal', () => {
  it('sums segment durations', () => {
    const segments = [
      { position: 1, kind: 'warmup', durationSec: 60, exerciseName: 'a' },
      { position: 2, kind: 'work', durationSec: 300, exerciseName: 'b' },
      { position: 3, kind: 'rest', durationSec: 30, exerciseName: null },
    ] as const;
    expect(segmentsTotal(segments)).toBe(390);
  });

  it('returns 0 for an empty list', () => {
    expect(segmentsTotal([])).toBe(0);
  });
});

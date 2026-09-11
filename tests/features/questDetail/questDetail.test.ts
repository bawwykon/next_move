import type { TFunction } from 'i18next';

import { segmentKindLabel } from '@/features/questDetail/segmentKind';
import { formatSegmentDuration } from '@/features/questDetail/segmentDuration';
import { segmentsTotal } from '@/features/questDetail/segmentsTotal';
import { englishT } from '../../i18n/testLocale';

let t: TFunction;
beforeAll(async () => {
  t = await englishT();
});

describe('segmentKindLabel', () => {
  it('maps every kind to a friendly capitalized label', () => {
    expect(segmentKindLabel('warmup', t)).toBe('Warm-up');
    expect(segmentKindLabel('work', t)).toBe('Work');
    expect(segmentKindLabel('rest', t)).toBe('Rest');
    expect(segmentKindLabel('cooldown', t)).toBe('Cooldown');
  });
});

describe('formatSegmentDuration', () => {
  it('formats sub-minute segments in seconds', () => {
    expect(formatSegmentDuration(30, t)).toBe('30s');
    expect(formatSegmentDuration(45, t)).toBe('45s');
    expect(formatSegmentDuration(59, t)).toBe('59s');
  });

  it('formats whole minutes', () => {
    expect(formatSegmentDuration(60, t)).toBe('1 min');
    expect(formatSegmentDuration(120, t)).toBe('2 min');
    expect(formatSegmentDuration(300, t)).toBe('5 min');
  });

  it('formats minutes plus seconds for >60s', () => {
    expect(formatSegmentDuration(90, t)).toBe('1 min 30s');
    expect(formatSegmentDuration(150, t)).toBe('2 min 30s');
    expect(formatSegmentDuration(135, t)).toBe('2 min 15s');
  });

  it('clamps negatives and rounds', () => {
    expect(formatSegmentDuration(0, t)).toBe('0s');
    expect(formatSegmentDuration(-5, t)).toBe('0s');
    expect(formatSegmentDuration(60.4, t)).toBe('1 min');
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

import {
  MAX_SEGMENTS,
  MAX_TOTAL_SEC,
  MIN_TOTAL_SEC,
  METER_SCALE_XP,
  REST_DURATION_PRESETS,
  SEGMENT_DURATION_PRESETS,
  ZONE_MARKS,
  isOverflow,
  isValidDraft,
  meterFill,
  projectedPoints,
  projectedXp,
  roundHalfUp,
  segmentPoints,
  totalDurationSec,
  validateDraft,
  zoneForXp,
} from '@/domain/customWorkout/model';
import type { CustomSegment } from '@/domain/customWorkout/model';

/**
 * BYQ-03 — pins for the builder's projection math, mirroring the
 * server-authoritative weights in complete_custom_workout (migrations 0027 +
 * 0029): beginner 1 / intermediate 2 / advanced 3 per 30s block, proportional
 * on half-blocks, XP = round-half-up(points × 3). Rest blocks (0029) are
 * worth zero but fill time and the segment cap.
 */
const RESOLVER = (slug: string) => {
  const table: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
    'wall-push-up': 'beginner',
    squat: 'intermediate',
    burpees: 'advanced',
  };
  return table[slug] ?? null;
};

const ex = (exerciseSlug: string, durationSec: number): CustomSegment => ({
  kind: 'exercise',
  exerciseSlug,
  durationSec,
});
const rest = (durationSec: number): CustomSegment => ({ kind: 'rest', durationSec });

describe('segment/projected points', () => {
  it('weights one 30s beginner block at 1 point', () => {
    expect(segmentPoints(ex('wall-push-up', 30), RESOLVER)).toBe(1);
    expect(segmentPoints(ex('squat', 30), RESOLVER)).toBe(2);
    expect(segmentPoints(ex('burpees', 30), RESOLVER)).toBe(3);
  });

  it('is proportional on non-block durations', () => {
    expect(segmentPoints(ex('wall-push-up', 45), RESOLVER)).toBeCloseTo(1.5);
    expect(segmentPoints(ex('burpees', 90), RESOLVER)).toBe(9);
  });

  it('scores unknown slugs as zero instead of guessing', () => {
    expect(segmentPoints(ex('mystery-move', 60), RESOLVER)).toBe(0);
  });

  it('projects the calibration anchors exactly', () => {
    // 480s of beginner work → 16 blocks × 1pt × 3 = 48 XP.
    expect(
      projectedXp(
        Array.from({ length: 16 }, () => ex('wall-push-up', 30)),
        RESOLVER,
      ),
    ).toBe(48);
    // 900s ceiling of advanced work → 30 × 3pts × 3 = 270 XP (scale max).
    expect(projectedXp([ex('burpees', 900)], RESOLVER)).toBe(METER_SCALE_XP);
  });

  it('rounds half-up like Postgres numeric round()', () => {
    // 45s intermediate + 45s advanced = 3 + 4.5 = 7.5 pts → 22.5 XP → 23.
    expect(projectedXp([ex('squat', 45), ex('burpees', 45)], RESOLVER)).toBe(23);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4)).toBe(2);
  });

  it('sums fractional points without rounding per segment', () => {
    const segments = [ex('squat', 45), ex('burpees', 45), ex('wall-push-up', 45)];
    expect(projectedPoints(segments, RESOLVER)).toBeCloseTo(9);
    expect(projectedXp(segments, RESOLVER)).toBe(27); // 9 × 3 exact
  });
});

describe('rest blocks', () => {
  it('are worth zero points at any duration', () => {
    for (const preset of REST_DURATION_PRESETS) {
      expect(segmentPoints(rest(preset), RESOLVER)).toBe(0);
    }
  });

  it('leave the projected XP unchanged while filling time', () => {
    const workOnly = [ex('squat', 45), ex('burpees', 45)];
    const withRest = [ex('squat', 45), rest(15), ex('burpees', 45)];
    expect(projectedXp(withRest, RESOLVER)).toBe(projectedXp(workOnly, RESOLVER));
    expect(totalDurationSec(withRest)).toBe(totalDurationSec(workOnly) + 15);
  });

  it('use the rest preset set, separate from exercise presets', () => {
    expect([...REST_DURATION_PRESETS]).toEqual([15, 30, 45, 60]);
    expect([...SEGMENT_DURATION_PRESETS]).toEqual([30, 45, 60, 90]);
  });

  it('count toward the segment cap like exercises', () => {
    const twelveWithRests = [
      ex('wall-push-up', 30),
      rest(15),
      ex('wall-push-up', 30),
      rest(15),
      ex('wall-push-up', 30),
      rest(15),
      ex('wall-push-up', 30),
      rest(15),
      ex('wall-push-up', 30),
      rest(15),
      ex('wall-push-up', 30),
      rest(15),
    ];
    expect(twelveWithRests).toHaveLength(MAX_SEGMENTS);
    expect(validateDraft(twelveWithRests)).toEqual([]);
    expect(validateDraft([...twelveWithRests, ex('wall-push-up', 30)])).toContain('segment_cap');
  });

  it('fill the minimum-time window with pure rests', () => {
    // 120s of rest alone is structurally valid — and worth exactly 0 XP.
    const allRest = [rest(30), rest(30), rest(30), rest(30)];
    expect(validateDraft(allRest)).toEqual([]);
    expect(projectedXp(allRest, RESOLVER)).toBe(0);
  });
});

describe('zones + meter', () => {
  it('marks zones at the quest-tier equivalents', () => {
    expect(ZONE_MARKS).toEqual({ easy: 50, normal: 100, hard: 200 });
    expect(zoneForXp(49)).toBe('easy');
    expect(zoneForXp(50)).toBe('easy');
    expect(zoneForXp(99)).toBe('easy');
    expect(zoneForXp(100)).toBe('normal');
    expect(zoneForXp(199)).toBe('normal');
    expect(zoneForXp(200)).toBe('hard');
    expect(zoneForXp(0)).toBe('easy');
  });

  it('flags overflow only past the Hard mark', () => {
    expect(isOverflow(200)).toBe(false);
    expect(isOverflow(201)).toBe(true);
  });

  it('clamps the meter fill to the scale ceiling', () => {
    expect(meterFill(0)).toBe(0);
    expect(meterFill(ZONE_MARKS.hard)).toBeCloseTo(ZONE_MARKS.hard / METER_SCALE_XP);
    expect(meterFill(400)).toBe(1);
    expect(meterFill(-5)).toBe(0);
    expect(meterFill(METER_SCALE_XP)).toBe(1);
  });
});

describe('guardrails', () => {
  const beg30 = ex('wall-push-up', 30);

  it('requires at least one segment', () => {
    expect(validateDraft([])).toEqual(['empty']);
    expect(isValidDraft([])).toBe(false);
  });

  it('accepts a draft inside every bound', () => {
    expect(validateDraft([beg30, beg30, beg30, beg30])).toEqual([]);
    expect(isValidDraft([beg30, beg30, beg30, beg30])).toBe(true);
  });

  it('rejects totals under 120s with min_total', () => {
    expect(validateDraft([{ ...beg30 }])).toContain('min_total');
    expect(validateDraft([beg30, { ...beg30 }, { ...beg30 }])).toContain('min_total');
    expect(validateDraft([ex('wall-push-up', 60), ex('wall-push-up', 60)])).not.toContain(
      'min_total',
    );
  });

  it('rejects totals over 900s with max_total', () => {
    expect(
      validateDraft(Array.from({ length: MAX_SEGMENTS }, () => ex('wall-push-up', 90))),
    ).toContain('max_total');
  });

  it('rejects more than twelve segments with segment_cap', () => {
    const thirteen = Array.from({ length: 13 }, () => ({ ...beg30 }));
    expect(thirteen).toHaveLength(13);
    const violations = validateDraft(thirteen);
    expect(violations).toContain('segment_cap');
    expect(violations).not.toContain('min_total'); // 13×30=390 is otherwise fine
  });

  it('bounds agree with the constants', () => {
    expect(MIN_TOTAL_SEC).toBe(120);
    expect(MAX_TOTAL_SEC).toBe(900);
    expect(MAX_SEGMENTS).toBe(12);
  });

  it('totals durations across mixed presets', () => {
    expect(totalDurationSec([beg30, ex('squat', 90)])).toBe(120);
  });
});

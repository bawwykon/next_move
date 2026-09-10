import {
  MAX_SEGMENTS,
  MAX_TOTAL_SEC,
  MIN_TOTAL_SEC,
  METER_SCALE_XP,
  REST_DURATION_PRESETS,
  SEGMENT_DURATION_PRESETS,
  ZONE_MARKS,
  classifyWorkout,
  isValidDraft,
  meterFill,
  projectedXp,
  validateDraft,
  zoneForXp,
} from '@/domain/customWorkout/model';
import type { CustomSegment } from '@/domain/customWorkout/model';

const RESOLVER = (slug: string) => {
  const table: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
    'wall-push-up': 'beginner',
    'step-touch': 'beginner',
    squat: 'intermediate',
    'push-up': 'intermediate',
    lunges: 'intermediate',
    plank: 'intermediate',
    'wall-sit': 'intermediate',
    burpees: 'advanced',
    'mountain-climber': 'advanced',
    'bicycle-crunch': 'advanced',
  };
  return table[slug] ?? null;
};

const ex = (exerciseSlug: string, durationSec: number): CustomSegment => ({
  kind: 'exercise',
  exerciseSlug,
  durationSec,
});

describe('custom workout classification & XP rebalance', () => {
  it('classifies all beginner exercises as Easy (100 XP)', () => {
    const draft = [ex('wall-push-up', 240), ex('step-touch', 240)]; // 480s total, beginner
    expect(projectedXp(draft, RESOLVER)).toBe(100);
    expect(classifyWorkout(draft, RESOLVER).tier).toBe('easy');
  });

  it('classifies 2+ Normal exercises (and 0 Hard) as Normal (200 XP)', () => {
    const draft = [ex('squat', 240), ex('push-up', 240)]; // 480s total, 2 intermediate, 0 hard
    expect(projectedXp(draft, RESOLVER)).toBe(200);
    expect(classifyWorkout(draft, RESOLVER).tier).toBe('normal');
  });

  it('classifies workouts with >= 45s Hard exercises as Hard (400 XP)', () => {
    const draft = [ex('squat', 240), ex('burpees', 240)]; // 480s, 240s hard >= 45s
    expect(projectedXp(draft, RESOLVER)).toBe(400);
    expect(classifyWorkout(draft, RESOLVER).tier).toBe('hard');
  });

  it('supports 3+ Hard exercises without cap (Hard / 400 XP)', () => {
    const draft = [ex('burpees', 240), ex('mountain-climber', 240), ex('bicycle-crunch', 240)];
    expect(projectedXp(draft, RESOLVER)).toBe(400);
    expect(classifyWorkout(draft, RESOLVER).tier).toBe('hard');
  });

  it('does not qualify as Hard if Hard time is insufficient (< 45s)', () => {
    const draft = [ex('wall-push-up', 240), ex('burpees', 30)]; // 30s hard < 45s, 0 normal
    expect(projectedXp(draft, RESOLVER)).toBe(100); // defaults to easy since < 45s hard
  });

  it('classifies 5+ Normal exercises (and 0 Hard) as Hard (400 XP)', () => {
    const draft = [
      ex('squat', 96),
      ex('push-up', 96),
      ex('lunges', 96),
      ex('plank', 96),
      ex('wall-sit', 96),
    ]; // 480s total, 5 intermediate, 0 hard
    expect(projectedXp(draft, RESOLVER)).toBe(400);
    expect(classifyWorkout(draft, RESOLVER).tier).toBe('hard');
  });

  it('use preset sets: segments [30, 45, 60], rest [30]', () => {
    expect([...REST_DURATION_PRESETS]).toEqual([30]);
    expect([...SEGMENT_DURATION_PRESETS]).toEqual([30, 45, 60]);
  });
});

describe('zones + meter', () => {
  it('marks zones at the new quest-tier equivalents', () => {
    expect(ZONE_MARKS).toEqual({ easy: 100, normal: 200, hard: 400 });
    expect(zoneForXp(99)).toBe('easy');
    expect(zoneForXp(100)).toBe('easy');
    expect(zoneForXp(199)).toBe('easy');
    expect(zoneForXp(200)).toBe('normal');
    expect(zoneForXp(399)).toBe('normal');
    expect(zoneForXp(400)).toBe('hard');
  });

  it('clamps the meter fill to the scale ceiling (400 XP)', () => {
    expect(meterFill(0)).toBe(0);
    expect(meterFill(400)).toBe(1);
    expect(meterFill(METER_SCALE_XP)).toBe(1);
  });
});

describe('guardrails', () => {
  const beg240 = ex('wall-push-up', 240);

  it('requires at least one segment', () => {
    expect(validateDraft([])).toEqual(['empty']);
    expect(isValidDraft([])).toBe(false);
  });

  it('accepts a draft inside every bound', () => {
    expect(validateDraft([beg240, beg240])).toEqual([]);
    expect(isValidDraft([beg240, beg240])).toBe(true);
  });

  it('rejects totals under 480s with min_total', () => {
    expect(validateDraft([ex('wall-push-up', 60)])).toContain('min_total');
    expect(validateDraft([beg240, beg240])).not.toContain('min_total');
  });

  it('rejects totals over 900s with max_total', () => {
    expect(
      validateDraft(Array.from({ length: MAX_SEGMENTS }, () => ex('wall-push-up', 90))),
    ).toContain('max_total');
  });

  it('bounds agree with constants', () => {
    expect(MIN_TOTAL_SEC).toBe(480);
    expect(MAX_TOTAL_SEC).toBe(900);
    expect(MAX_SEGMENTS).toBe(12);
  });
});

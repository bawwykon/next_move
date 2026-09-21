/**
 * Phase 2 / BYQ-03 — client mirror of the server-owned custom-workout economy
 * (Ref 12, migration 0027). Pure math + validation only: every figure here is
 * a PROJECTION for the builder UI. The authoritative numbers always come from
 * complete_custom_workout, recomputed from the saved definition.
 *
 * Weights per 30s block, proportional (45s = 1.5 blocks):
 *   beginner/easy 1 · intermediate/normal 2 · advanced/hard 3
 *   XP = round-half-up(total_points × 3)   Calibration: 480s beginner = 48,
 *   900s advanced = 270 (scale ceiling).
 */
import type { ExerciseDifficulty } from '@/domain/exercises/difficulty';

/**
 * A builder block. Exercises carry their catalog slug; rest blocks (WK ruling
 * 2026-08-22) contribute ZERO points but count toward the total time and the
 * segment cap, exactly like exercises.
 */
export type CustomSegment =
  | { kind: 'exercise'; exerciseSlug: string; durationSec: number }
  | { kind: 'rest'; durationSec: number };

/** Duration chips for exercise rows. */
export const SEGMENT_DURATION_PRESETS = [30, 45, 60] as const;
/** Duration chips for rest rows (fixed at 30s). */
export const REST_DURATION_PRESETS = [30] as const;

export const MIN_SEGMENTS = 1;
export const MAX_SEGMENTS = 16;
export const MIN_TOTAL_SEC = 480;
export const MAX_TOTAL_SEC = 1200;
export const NAME_MAX_CHARS = 60;
/**
 * Legacy English fallback quest name. Screens prefer `t('build.defaultName')`
 * (Arabic review: no raw English in the UI); this stays as the last-resort
 * DB fallback in saveCustomWorkout and the blank-field sentinel for rows
 * saved before localization.
 */
export const DEFAULT_WORKOUT_NAME = 'Custom Quest';

/** Meter scale: ceiling at 400 XP. */
export const METER_SCALE_XP = 400;
/** Zone marks on the meter, mirroring quest tiers (easy 100 / normal 200 / hard 400). */
export const ZONE_MARKS = { easy: 100, normal: 200, hard: 400 } as const;

const BLOCK_SEC = 30;

const WEIGHTS: Record<ExerciseDifficulty, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

/**
 * Difficulty resolver injected by the caller (the repo resolves slugs against
 * the server-authoritative exercise_library.difficulty column).
 */
export type DifficultyResolver = (slug: string) => ExerciseDifficulty | null;

export function segmentPoints(segment: CustomSegment, difficultyOf: DifficultyResolver): number {
  // Rest blocks are worth nothing — the meter freezes while they run.
  if (segment.kind === 'rest') {
    return 0;
  }
  const difficulty = difficultyOf(segment.exerciseSlug);
  if (difficulty === null) {
    return 0;
  }
  return (segment.durationSec / BLOCK_SEC) * WEIGHTS[difficulty];
}

/** Fractional total points across the draft (half-blocks included). */
export function projectedPoints(
  segments: readonly CustomSegment[],
  difficultyOf: DifficultyResolver,
): number {
  return segments.reduce((sum, segment) => sum + segmentPoints(segment, difficultyOf), 0);
}

/** Round-half-up on positives (.5 → up), matching Postgres numeric round(). */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

export const HARD_EXERCISE_SLUGS = new Set(['burpees', 'mountain-climber', 'bicycle-crunch']);
/**
 * Tier scoring (owner rule): a hard block is worth 2 points, a normal
 * (intermediate) block 1 point; easy/beginner and rest blocks score nothing.
 * Hard = supported hard (1+ hard blocks and 4+ points, e.g. 1 hard + 2
 * normal) or sheer volume (5+ normal blocks with 0 hard). Normal = 2+
 * points. Easy = 0-1. A lone hard block diluted in easy filler scores 2 =
 * normal; 4 normals without hard score 4 but stay normal (volume hard needs
 * 5). Intensity and duration stay separate concerns: the 480s floor
 * guarantees a real session, the score guarantees honest intensity.
 */
export const HARD_BLOCK_POINTS = 2;
export const NORMAL_BLOCK_POINTS = 1;
export const HARD_TIER_SCORE = 4;
export const NORMAL_TIER_SCORE = 2;
export const MIN_NORMAL_COUNT_FOR_HARD_TIER = 5;

export function classifyWorkout(
  segments: readonly CustomSegment[],
  difficultyOf: DifficultyResolver,
): { xp: number; tier: MeterZone } {
  let hardBlocks = 0;
  let normalBlocks = 0;

  for (const seg of segments) {
    if (seg.kind !== 'exercise') {
      continue;
    }
    const diff = difficultyOf(seg.exerciseSlug);
    if (diff === 'advanced' || HARD_EXERCISE_SLUGS.has(seg.exerciseSlug)) {
      hardBlocks += 1;
    } else if (diff === 'intermediate') {
      normalBlocks += 1;
    }
  }

  const score = hardBlocks * HARD_BLOCK_POINTS + normalBlocks * NORMAL_BLOCK_POINTS;
  if (
    (hardBlocks >= 1 && score >= HARD_TIER_SCORE) ||
    (hardBlocks === 0 && normalBlocks >= MIN_NORMAL_COUNT_FOR_HARD_TIER)
  ) {
    return { xp: 400, tier: 'hard' };
  }
  if (score >= NORMAL_TIER_SCORE) {
    return { xp: 200, tier: 'normal' };
  }
  return { xp: 100, tier: 'easy' };
}

/** Projected base XP — the number the meter shows. */
export function projectedXp(
  segments: readonly CustomSegment[],
  difficultyOf: DifficultyResolver,
): number {
  return classifyWorkout(segments, difficultyOf).xp;
}

export type MeterZone = 'easy' | 'normal' | 'hard';

/** Highest zone whose mark the projected XP has reached. */
export function zoneForXp(xp: number): MeterZone {
  if (xp >= ZONE_MARKS.hard) {
    return 'hard';
  }
  if (xp >= ZONE_MARKS.normal) {
    return 'normal';
  }
  return 'easy';
}

/** True once the fill passes the Hard mark — the meter glows past it. */
export function isOverflow(xp: number): boolean {
  return xp > ZONE_MARKS.hard;
}

/** 0..1 fill fraction on the meter scale, clamped at the ceiling. */
export function meterFill(xp: number): number {
  return Math.min(1, Math.max(0, xp / METER_SCALE_XP));
}

/* ------------------------------ guardrails ------------------------------- */

export type GuardrailViolation = 'empty' | 'segment_cap' | 'min_total' | 'max_total';

/**
 * Structural checks mirroring complete_custom_workout (0038): ≥1 and ≤16
 * segments, total 480–1200s. Durations outside the preset set cannot be
 * produced by the builder UI (chips only), so they are not re-checked here.
 */
export function validateDraft(segments: readonly CustomSegment[]): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  if (segments.length < MIN_SEGMENTS) {
    violations.push('empty');
    return violations;
  }
  if (segments.length > MAX_SEGMENTS) {
    violations.push('segment_cap');
  }
  const total = totalDurationSec(segments);
  if (total < MIN_TOTAL_SEC) {
    violations.push('min_total');
  }
  if (total > MAX_TOTAL_SEC) {
    violations.push('max_total');
  }
  return violations;
}

export function isValidDraft(segments: readonly CustomSegment[]): boolean {
  return validateDraft(segments).length === 0;
}

export function totalDurationSec(segments: readonly CustomSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.durationSec, 0);
}

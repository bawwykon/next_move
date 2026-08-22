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

export interface CustomSegment {
  exerciseSlug: string;
  durationSec: number;
}

export interface CustomWorkoutDraft {
  name: string;
  segments: CustomSegment[];
}

export const SEGMENT_DURATION_PRESETS = [30, 45, 60, 90] as const;

export const MIN_SEGMENTS = 1;
export const MAX_SEGMENTS = 12;
export const MIN_TOTAL_SEC = 120;
export const MAX_TOTAL_SEC = 900;
export const NAME_MAX_CHARS = 60;
export const DEFAULT_WORKOUT_NAME = 'Custom Quest';

/** Meter scale: the calibration ceiling fills the bar; Hard's mark sits at 200. */
export const METER_SCALE_XP = 270;
/** Zone marks on the meter, mirroring quest tiers (easy 50 / normal 100 / hard 200). */
export const ZONE_MARKS = { easy: 50, normal: 100, hard: 200 } as const;

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

/** Projected base XP — the number the meter shows. */
export function projectedXp(
  segments: readonly CustomSegment[],
  difficultyOf: DifficultyResolver,
): number {
  return roundHalfUp(projectedPoints(segments, difficultyOf) * 3);
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
 * Structural checks mirroring complete_custom_workout (0027): ≥1 and ≤12
 * segments, total 120–900s. Durations outside the preset set cannot be
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

/**
 * S8-01 — level/XP/mastery progression math, mirroring the server curves in
 * 0020 complete_quest (FR-XP-2/3, FR-MAS-2; Ref 08). Pure and deterministic;
 * these are display-time derivations over the server-authoritative profile
 * columns (total_xp, level, mastery.points) — never used to award anything.
 *
 * Level curve: 100 × L XP steps forward from level L (FR-XP-2), i.e. the
 * cumulative start of level L is 50·L·(L−1) — the exact boundary
 * `level_for_xp` encodes (50·L·(L−1) ≤ xp < 50·(L+1)·L).
 */

export interface LevelXpBounds {
  /** Total XP at which level L begins (level 1 → 0). */
  start: number;
  /** Total XP at which level L ends, exclusive. */
  end: number;
  /** 100 × L — the span the bar renders over. */
  span: number;
}

export function levelXpBounds(levelInput: number): LevelXpBounds {
  const level = Math.max(1, Math.floor(levelInput));
  const start = 50 * level * (level - 1);
  const span = 100 * level;
  return { start, end: start + span, span };
}

export interface XpProgress {
  /** XP accumulated inside the current level, clamped to [0, span]. */
  into: number;
  /** 100 × level — what the bar is drawn against. */
  needed: number;
  /** into / needed, clamped to [0, 1]. */
  fraction: number;
}

export function xpProgress(totalXpInput: number, levelInput: number): XpProgress {
  const total = Math.max(0, Math.floor(totalXpInput));
  const { start, span } = levelXpBounds(levelInput);
  const into = Math.min(span, Math.max(0, total - start));
  return { into, needed: span, fraction: span === 0 ? 0 : into / span };
}

/**
 * FR-XP-3 — level titles, exact mirror of `public.level_title` (0020).
 * 1 Beginner, 5 Apprentice, 10 Adventurer, 25 Warrior, 50 Champion, 100 Legend.
 */
export function levelTitle(levelInput: number): string {
  const level = Math.max(0, Math.floor(levelInput));
  if (level >= 100) return 'Legend';
  if (level >= 50) return 'Champion';
  if (level >= 25) return 'Warrior';
  if (level >= 10) return 'Adventurer';
  if (level >= 5) return 'Apprentice';
  return 'Beginner';
}

/**
 * Big-3 MASTERY-LEVELS — mastery rank ladder 1..20 per track. Thresholds are
 * the cumulative points at which each level begins (exact mirror of
 * `mastery_level_for_points`, 0047). Anchors: L2 at 100, L5 at 500, L10 at
 * 2000 (awards the track's Master Badge); L11+ advance 500 per level to a
 * 7000-point L20 cap (~8 months of single-track daily focus).
 * Ranks: 1 Novice, 2–4 Apprentice, 5–9 Adept, 10–20 Master.
 */
export const MASTERY_LEVEL_STARTS: readonly number[] = Object.freeze([
  0, 100, 250, 375, 500, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500,
  6000, 6500, 7000,
]);

export const MASTERY_MAX_LEVEL = 20;

/** Span of the final band (L20 is unbounded above; the bar renders full). */
export const MASTERY_CAP_SPAN = 500;

export function masteryLevelForPoints(pointsInput: number): number {
  const points = Math.max(0, Math.floor(pointsInput));
  let level = 1;
  for (let index = 0; index < MASTERY_LEVEL_STARTS.length; index += 1) {
    if (points >= (MASTERY_LEVEL_STARTS[index] ?? 0)) {
      level = index + 1;
    } else {
      break;
    }
  }
  return level;
}

export interface MasteryProgress {
  level: number;
  /** Points accumulated inside the current level's band. */
  into: number;
  /** The current level's band span (500 at the cap, rendered full). */
  needed: number;
  /** into / needed, clamped to [0, 1]. */
  fraction: number;
}

export function masteryProgress(pointsInput: number): MasteryProgress {
  const points = Math.max(0, Math.floor(pointsInput));
  const level = masteryLevelForPoints(points);
  if (level >= MASTERY_MAX_LEVEL) {
    return { level, into: MASTERY_CAP_SPAN, needed: MASTERY_CAP_SPAN, fraction: 1 };
  }
  const start = MASTERY_LEVEL_STARTS[level - 1] ?? 0;
  const next = MASTERY_LEVEL_STARTS[level] ?? start;
  const needed = Math.max(1, next - start);
  const into = Math.min(needed, Math.max(0, points - start));
  return { level, into, needed, fraction: into / needed };
}

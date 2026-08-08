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
 * FR-MAS-2 — mastery level from points: floor(points/250) + 1, capped at 10
 * (mirror of `mastery_level_for_points`, 0020).
 */
export function masteryLevelForPoints(pointsInput: number): number {
  const points = Math.max(0, Math.floor(pointsInput));
  return Math.min(10, Math.floor(points / 250) + 1);
}

export interface MasteryProgress {
  level: number;
  /** Points remaining in the current level's 250-point band, clamped. */
  into: number;
  /** The current level's fixed 250-point band. */
  needed: number;
  /** into / needed, clamped to [0, 1]. */
  fraction: number;
}

export function masteryProgress(pointsInput: number): MasteryProgress {
  const points = Math.max(0, Math.floor(pointsInput));
  const level = masteryLevelForPoints(points);
  const into = Math.min(250, Math.max(0, points - 250 * (level - 1)));
  return { level, into, needed: 250, fraction: into / 250 };
}

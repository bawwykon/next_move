/**
 * S6-01 — victory screen formatting. Pure, side-effect free: every XP, level,
 * mastery and unlock figure rendered on victory comes from the authoritative
 * complete_quest payload (S5-05), never recomputed on the client (FR-XP-7).
 */
import type { TFunction } from 'i18next';

import type { QuestCategory } from '@/domain/recommendation/types';
import type {
  AchievementUnlock,
  CompletionResult,
  CosmeticUnlock,
  MasteryResult,
  XpBreakdown,
} from '@/domain/completion/types';

/* ------------------------------- XP breakdown --------------------------- */

export interface XpBreakdownRow {
  label: string;
  xp: number;
}

const BREAKDOWN_KEYS = {
  quest: 'victory.breakdownQuest',
  first: 'victory.breakdownFirst',
  daily: 'victory.breakdownDaily',
  weekly: 'victory.breakdownWeekly',
  streak: 'victory.breakdownStreak',
  perfect: 'victory.breakdownPerfect',
} as const;

/**
 * FR-XP-6 — one row per stage that actually paid out, in a fixed order.
 * Zero-value stages are dropped; the total row is separate (below), so the
 * rows + total never hide a grant. BYQ-04 — baseLabel renames the base stage
 * row to the custom quest's own name. Labels via `t` (I18N-01).
 * Pre-0043 payloads lack first/perfect lines — read as 0.
 */
export function xpBreakdownRows(
  xp: XpBreakdown,
  t: TFunction,
  baseLabel?: string,
): XpBreakdownRow[] {
  const order: ('quest' | 'first' | 'daily' | 'weekly' | 'streak' | 'perfect')[] = [
    'quest',
    'first',
    'daily',
    'weekly',
    'streak',
    'perfect',
  ];
  return order
    .map((stage) => ({
      label: stage === 'quest' && baseLabel ? baseLabel : t(BREAKDOWN_KEYS[stage]),
      xp: xp[stage] ?? 0,
    }))
    .filter((row) => row.xp > 0);
}

export function xpBreakdownTotal(xp: XpBreakdown): number {
  return xp.total;
}

/** Sum of the visible breakdown rows — must equal the authoritative total. */
export function breakdownRowSum(rows: XpBreakdownRow[]): number {
  return rows.reduce((sum, row) => sum + row.xp, 0);
}

/* --------------------------------- Mastery ------------------------------ */

export interface MasteryDelta {
  track: QuestCategory;
  trackLabel: string;
  pointsBefore: number;
  pointsAfter: number;
  pointsGained: number;
  levelBefore: number;
  levelAfter: number;
  levelTitle: string;
  leveledUp: boolean;
}

/**
 * Big-3 MASTERY-LEVELS — per-track mastery ranks. 1 Novice, 2–4 Apprentice,
 * 5–9 Adept, 10–20 Master (Level 10 awards the track's Master Badge).
 * Copy via `t` (I18N-01).
 */
const MASTERY_TITLE_KEYS = {
  novice: 'victory.masteryTitle.novice',
  apprentice: 'victory.masteryTitle.apprentice',
  adept: 'victory.masteryTitle.adept',
  master: 'victory.masteryTitle.master',
} as const;

export const MASTERY_CAP = 20;

export function masteryLevelTitle(level: number, t: TFunction): string {
  const clamped = Math.floor(level);
  if (clamped >= 10) {
    return t(MASTERY_TITLE_KEYS.master);
  }
  if (clamped >= 5) {
    return t(MASTERY_TITLE_KEYS.adept);
  }
  if (clamped >= 2) {
    return t(MASTERY_TITLE_KEYS.apprentice);
  }
  return t(MASTERY_TITLE_KEYS.novice);
}

export function masteryTrackLabel(track: QuestCategory, t: TFunction): string {
  return t(`board.categories.${track}`);
}

/** Per-track delta rows for the mastery card (FR-MAS-6) — never empty. */
export function masteryDeltas(rows: MasteryResult[], t: TFunction): MasteryDelta[] {
  return rows.map((row) => ({
    track: row.track,
    trackLabel: masteryTrackLabel(row.track, t),
    pointsBefore: row.points_before,
    pointsAfter: row.points_after,
    pointsGained: row.points_after - row.points_before,
    levelBefore: row.level_before,
    levelAfter: row.level_after,
    levelTitle: masteryLevelTitle(row.level_after, t),
    leveledUp: row.level_after > row.level_before,
  }));
}

/* --------------------------------- Unlocks ------------------------------ */

export interface UnlockOverview {
  achievements: AchievementUnlock[];
  cosmetics: CosmeticUnlock[];
  count: number;
  hasUnlocks: boolean;
}

/** Achievement + cosmetic grouping for the unlocks card. */
export function unlockOverview(result: CompletionResult): UnlockOverview {
  const count = result.achievements.length + result.cosmetics.length;
  return {
    achievements: result.achievements,
    cosmetics: result.cosmetics,
    count,
    hasUnlocks: count > 0,
  };
}

/* ------------------------------ reconcile -------------------------------- */

export interface SyncedCompletion {
  questId: string;
  result: CompletionResult;
}

export interface ReconcileState {
  /** True once the authoritative payload for this quest has landed. */
  synced: boolean;
  result: CompletionResult | null;
}

/**
 * Pending → payload reconcile selector. While the outbox flush is in flight
 * the victory screen has no numbers to show (FR-XP-7 forbids client math), so
 * this returns synced=false; the instant the store's lastCompletion matches
 * the finished quest the authoritative result is handed to the UI.
 */
export function reconcileCompletion(
  last: SyncedCompletion | null,
  questId?: string,
): ReconcileState {
  if (!last) {
    return { synced: false, result: null };
  }
  if (questId !== undefined && last.questId !== questId) {
    return { synced: false, result: null };
  }
  return { synced: true, result: last.result };
}

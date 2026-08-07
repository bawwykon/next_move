/**
 * S6-01 — victory screen formatting. Pure, side-effect free: every XP, level,
 * mastery and unlock figure rendered on victory comes from the authoritative
 * complete_quest payload (S5-05), never recomputed on the client (FR-XP-7).
 */
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

const BREAKDOWN_LABELS: Record<'quest' | 'daily' | 'weekly' | 'streak', string> = {
  quest: 'Quest',
  daily: 'Daily bonus',
  weekly: 'Weekly bonus',
  streak: 'Streak bonus',
};

/**
 * FR-XP-6 — one row per stage that actually paid out, in a fixed order.
 * Zero-value stages are dropped; the total row is separate (below), so the
 * rows + total never hide a grant.
 */
export function xpBreakdownRows(xp: XpBreakdown): XpBreakdownRow[] {
  const order: ('quest' | 'daily' | 'weekly' | 'streak')[] = ['quest', 'daily', 'weekly', 'streak'];
  return order
    .map((stage) => ({ label: BREAKDOWN_LABELS[stage], xp: xp[stage] }))
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
 * FR-MAS-2/3 — per-track mastery titles. 1 Novice, 2 Explorer, 3 Adept,
 * 4 Expert, 5 through the cap (10) Master.
 */
const MASTERY_TITLES: Record<number, string> = {
  1: 'Novice',
  2: 'Explorer',
  3: 'Adept',
  4: 'Expert',
  5: 'Master',
};

export const MASTERY_CAP = 10;

export function masteryLevelTitle(level: number): string {
  const clamped = Math.min(Math.max(level, 1), 5);
  return MASTERY_TITLES[clamped] ?? 'Novice';
}

const TRACK_LABELS: Record<QuestCategory, string> = {
  strength: 'Strength',
  endurance: 'Endurance',
  mobility: 'Mobility',
  discipline: 'Discipline',
};

export function masteryTrackLabel(track: QuestCategory): string {
  return TRACK_LABELS[track];
}

/** Per-track delta rows for the mastery card (FR-MAS-6) — never empty. */
export function masteryDeltas(rows: MasteryResult[]): MasteryDelta[] {
  return rows.map((row) => ({
    track: row.track,
    trackLabel: masteryTrackLabel(row.track),
    pointsBefore: row.points_before,
    pointsAfter: row.points_after,
    pointsGained: row.points_after - row.points_before,
    levelBefore: row.level_before,
    levelAfter: row.level_after,
    levelTitle: masteryLevelTitle(row.level_after),
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

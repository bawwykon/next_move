/**
 * S9-01 — the streak milestone ladder for countdown copy. MIRROR of the server
 * engine (supabase/migrations/0020_complete_quest.sql §Streak milestone): a
 * FRESH 3/7/30/100-day streak pays 50/150/500/1500 XP, once per milestone
 * (unique (profile_id, reward_day) is the server's gate). The client never
 * awards anything — it only derives the NEXT milestone from the same ladder,
 * so the countdown can never drift from what the server will actually pay.
 * Pure: no clocks injected, plain day counts.
 */
export const STREAK_MILESTONE_DAYS: readonly number[] = [3, 7, 30, 100];

/** XP per ladder rung — kept index-aligned with STREAK_MILESTONE_DAYS. */
export const STREAK_MILESTONE_XP: readonly number[] = [50, 150, 500, 1500];

/** Server mirror of `case v_granted when 3 then 50 ... else 1500`. */
export function streakMilestoneXp(days: number): number {
  const index = STREAK_MILESTONE_DAYS.indexOf(days);
  return index === -1 ? 0 : (STREAK_MILESTONE_XP[index] ?? 0);
}

export interface NextStreakMilestone {
  /** The ladder day the countdown points at (3/7/30/100). */
  days: number;
  /** What the server pays when that day is reached fresh. */
  xp: number;
  /** Whole days from the current streak to that milestone. */
  daysTo: number;
}

/**
 * The first ladder rung STRICTLY above the current streak. A streak sitting
 * exactly on a milestone already earned it, so the countdown advances to the
 * next rung; at/above 100 there is nothing left to count down to (null). The
 * input is clamped to a non-negative whole day count.
 */
export function nextStreakMilestone(current: number): NextStreakMilestone | null {
  const streak = Math.max(0, Math.floor(current));
  for (let index = 0; index < STREAK_MILESTONE_DAYS.length; index += 1) {
    const days = STREAK_MILESTONE_DAYS[index]!;
    if (days > streak) {
      return { days, xp: streakMilestoneXp(days), daysTo: days - streak };
    }
  }
  return null;
}

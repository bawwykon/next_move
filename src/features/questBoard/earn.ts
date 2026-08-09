/**
 * S9-01 — the board's habit surface: the daily-challenge cell, the weekly
 * next-earn line, and the streak-milestone countdown. Pure mirrors of the
 * server math in supabase/migrations/0020_complete_quest.sql (daily bonus,
 * weekly bonus, streak ladder) — nothing here fetches, mutates, or renders.
 * Copy is encouragement-only (Ref 05 §7.5 / FR-STR-2: no pressure phrasing).
 */
import { nextStreakMilestone } from '@/domain/streak/milestone';

/** Mirror of `v_daily` — paid on the first completion of the local day. */
export const DAILY_BONUS_XP = 75;

/** Mirror of the weekly bonus paid on the 3rd completion of the Mon–Sun week. */
export const WEEKLY_BONUS_XP = 500;

export interface DailyProgress {
  /** Any completion whose local day key equals today. */
  done: boolean;
  target: number;
}

/**
 * FR-BOARD — the daily challenge cell is done exactly when the local day has
 * at least one completion (the server's `v_daily` pays on the first one).
 */
export function dailyChallengeProgress(
  completions: readonly { dayKey: string | null }[],
  todayKey: string,
): DailyProgress {
  return { done: completions.some((c) => c.dayKey === todayKey), target: 1 };
}

export interface DailyCellCopy {
  goal: string;
  message: string;
  reward: string;
  meta: string;
}

/** The exact strings the daily cell renders for each state. */
export function dailyCellCopy(done: boolean): DailyCellCopy {
  if (done) {
    return {
      goal: 'Daily challenge complete!',
      message: 'Bonus banked — tomorrow has your name on it.',
      reward: `+${DAILY_BONUS_XP} XP`,
      meta: '1/1',
    };
  }
  return {
    goal: 'Daily Challenge',
    message: 'One quest today, one bonus earned.',
    reward: `+${DAILY_BONUS_XP} XP`,
    meta: '0/1',
  };
}

/**
 * The weekly card's "next-earn" line — how many more quests until the bonus
 * pays, or the rollover countdown once it has. `daysUntilNextMonday` is whole
 * calendar days in zone time (see daysUntilNextMonday), so the rollover copy
 * stays day-accurate across DST.
 */
export function weeklyEarnCopy(done: number, target: number, daysUntilNextMonday: number): string {
  if (done >= target) {
    if (daysUntilNextMonday === 1) {
      return 'Bonus banked — the next one starts tomorrow.';
    }
    return `Bonus banked — the next one starts in ${daysUntilNextMonday} days.`;
  }
  const remaining = target - done;
  const unit = remaining === 1 ? 'quest' : 'quests';
  return `${remaining} more ${unit} to the +${WEEKLY_BONUS_XP} XP bonus`;
}

/**
 * Whole calendar days until the next Monday in THIS zone (local fields, so it
 * is DST-proof by construction: Monday-after-Sunday is 1 even on a 23h/25h
 * day). Monday itself reports 7 — the coming week's Monday.
 */
export function daysUntilNextMonday(now: Date): number {
  return (7 - ((now.getDay() + 6) % 7)) % 7 || 7;
}

export interface StreakPillCopy {
  /** The standing headline (existing board pill copy). */
  main: string;
  /** Milestone countdown line, or null when there is nothing to count to. */
  milestone: string | null;
}

/**
 * The streak pill's lines. Live streaks get a countdown to the next server
 * milestone; a dead streak gets the first-rung invitation; past the top of the
 * ladder there is no countdown (already at/past every server reward).
 */
export function streakPillCopy(current: number): StreakPillCopy {
  if (current > 0) {
    const unit = current === 1 ? 'day' : 'days';
    const milestone = nextStreakMilestone(current);
    return {
      main: `${current} ${unit} strong`,
      milestone: milestone
        ? `${milestone.daysTo} ${milestone.daysTo === 1 ? 'day' : 'days'} to a ${milestone.days}-day bonus`
        : null,
    };
  }
  return {
    main: 'Your adventure is waiting.',
    milestone: null,
  };
}

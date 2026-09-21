/**
 * S9-01 — the board's habit surface: the daily-challenge cell, the weekly
 * next-earn line, and the streak-milestone countdown. Pure mirrors of the
 * server math in supabase/migrations/0020_complete_quest.sql (daily bonus,
 * weekly bonus, streak ladder) — nothing here fetches, mutates, or renders.
 * Copy is encouragement-only (Ref 05 §7.5 / FR-STR-2: no pressure phrasing).
 * The streak countdown line is the S9-02-unified builder shared with the
 * Profile row (src/features/profile/format.ts).
 */
import type { TFunction } from 'i18next';

import { TRIAL_TRACK, type WeeklyTrialId } from '@/domain/board/weeklyTrial';
import { streakMilestoneLine } from '@/features/profile/format';

/** Mirror of `v_daily` — paid on the first completion of the local day. */
export const DAILY_BONUS_XP = 150;

/** Mirror of the weekly bonus paid on the 3rd completion of the Mon–Sun week. */
export const WEEKLY_BONUS_XP = 1000;

/**
 * Mirror of the 0048 trial mastery bonus: when the weekly bonus pays, +60
 * mastery lands in the active trial's track (relaxed rule — any 3
 * completions; untouched tracks earn their own row). Shown under the XP on
 * the weekly card so the payout is never a surprise.
 */
export const WEEKLY_TRIAL_MASTERY_XP = 60;

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
export function dailyCellCopy(done: boolean, t: TFunction): DailyCellCopy {
  if (done) {
    return {
      goal: t('board.daily.goalDone'),
      message: t('board.daily.messageDone'),
      reward: t('board.xpReward', { xp: DAILY_BONUS_XP }),
      meta: '1/1',
    };
  }
  return {
    goal: t('board.daily.goalTodo'),
    message: t('board.daily.messageTodo'),
    reward: t('board.xpReward', { xp: DAILY_BONUS_XP }),
    meta: '0/1',
  };
}

/**
 * The weekly card's "next-earn" line — how many more quests until the bonus
 * pays, or the rollover countdown once it has. `daysUntilNextMonday` is whole
 * calendar days in zone time (see daysUntilNextMonday), so the rollover copy
 * stays day-accurate across DST.
 */
export function weeklyEarnCopy(
  done: number,
  target: number,
  daysUntilNextMonday: number,
  t: TFunction,
): string {
  if (done >= target) {
    if (daysUntilNextMonday === 1) {
      return t('board.weeklyBankedTomorrow');
    }
    return t('board.weeklyBankedInDays', { count: daysUntilNextMonday });
  }
  const remaining = target - done;
  return t('board.weeklyRemaining', { count: remaining, xp: WEEKLY_BONUS_XP });
}

/**
 * The weekly card's second reward line, under the XP: the 0048 mastery bonus
 * in the active trial's track. Composed only from already-translated words
 * (track name + mastery noun), so no locale needs a new glyph — this matters
 * for Chinese, whose font is subset to in-app characters.
 */
export function trialMasteryCopy(t: TFunction, trial: WeeklyTrialId): string {
  return t('board.masteryReward', {
    xp: WEEKLY_TRIAL_MASTERY_XP,
    track: t(`board.categories.${TRIAL_TRACK[trial]}`),
    mastery: t('profile.mastery'),
  });
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
 * The streak pill's lines. Live streaks carry the S9-02-unified milestone
 * countdown (identical wording to the Profile row); a dead streak shares the
 * Profile's full two-sentence invitation (FR-STR-2).
 */
export function streakPillCopy(
  current: number,
  t: TFunction,
  locale: string = 'en',
): StreakPillCopy {
  if (current > 0) {
    return {
      main: t('board.streakActive', { count: current }),
      milestone: streakMilestoneLine(current, t, locale),
    };
  }
  return {
    main: t('board.streakIdle'),
    milestone: null,
  };
}

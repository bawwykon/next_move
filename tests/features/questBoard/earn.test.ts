import type { TFunction } from 'i18next';

import {
  DAILY_BONUS_XP,
  WEEKLY_BONUS_XP,
  WEEKLY_TRIAL_MASTERY_XP,
  dailyCellCopy,
  dailyChallengeProgress,
  daysUntilNextMonday,
  streakPillCopy,
  trialMasteryCopy,
  weeklyEarnCopy,
} from '@/features/questBoard/earn';
import { englishT, arabicT } from '../../i18n/testLocale';

let t: TFunction;
let ta: TFunction;
beforeAll(async () => {
  t = await englishT();
  ta = await arabicT();
});

describe('dailyChallengeProgress', () => {
  const completion = (dayKey: string | null) => ({ dayKey });

  it('is done when any completion has today key', () => {
    expect(
      dailyChallengeProgress([completion(null), completion('2026-08-05')], '2026-08-05').done,
    ).toBe(true);
  });

  it('is pending before the first completion of the day', () => {
    expect(
      dailyChallengeProgress([completion('2026-08-04'), completion('2026-08-03')], '2026-08-05')
        .done,
    ).toBe(false);
  });

  it('ignores malformed and null day keys', () => {
    expect(
      dailyChallengeProgress(
        [completion(null), completion('nope'), completion('2026-13-99')],
        '2026-08-05',
      ).done,
    ).toBe(false);
  });

  it('targets exactly one quest a day (the first pays the bonus)', () => {
    expect(dailyChallengeProgress([], '2026-08-05').target).toBe(1);
  });
});

describe('dailyCellCopy', () => {
  it('announces the bonus and the day count when pending', () => {
    expect(dailyCellCopy(false, t)).toEqual({
      goal: 'Daily Challenge',
      message: 'One quest today, one bonus earned.',
      reward: `+${DAILY_BONUS_XP} XP`,
      meta: '0/1',
    });
  });

  it('celebrates when the day is done', () => {
    expect(dailyCellCopy(true, t)).toEqual({
      goal: 'Daily challenge complete!',
      message: 'Bonus banked — tomorrow has your name on it.',
      reward: `+${DAILY_BONUS_XP} XP`,
      meta: '1/1',
    });
  });

  it('never leaks server rule syntax (no {} >= or unlock internals)', () => {
    for (const done of [false, true]) {
      const copy = Object.values(dailyCellCopy(done, t)).join(' ');
      expect(copy).not.toMatch(/[{}]|>=|<=|unlock_rule|reward_day|complete_quest/);
    }
  });
});

describe('weeklyEarnCopy', () => {
  it('counts remaining quests to the bonus, singular and plural', () => {
    expect(weeklyEarnCopy(1, 3, 4, t)).toBe(`2 more quests to the +${WEEKLY_BONUS_XP} XP bonus`);
    expect(weeklyEarnCopy(2, 3, 4, t)).toBe(`1 more quest to the +${WEEKLY_BONUS_XP} XP bonus`);
  });

  it('asks for the whole week when nothing is done yet', () => {
    expect(weeklyEarnCopy(0, 3, 4, t)).toBe(`3 more quests to the +${WEEKLY_BONUS_XP} XP bonus`);
  });

  it('counts down the rollover once the bonus has paid', () => {
    expect(weeklyEarnCopy(3, 3, 1, t)).toBe('Bonus banked — the next one starts tomorrow.');
    expect(weeklyEarnCopy(3, 3, 5, t)).toBe('Bonus banked — the next one starts in 5 days.');
    expect(weeklyEarnCopy(4, 3, 2, t)).toContain('starts in 2 days');
  });
});

describe('daysUntilNextMonday', () => {
  it('is 7 on Monday (the coming week), 1 on Sunday', () => {
    expect(daysUntilNextMonday(new Date(2026, 7, 3))).toBe(7); // Mon Aug 3
    expect(daysUntilNextMonday(new Date(2026, 7, 9))).toBe(1); // Sun Aug 9
  });

  it('counts Wed 5 → Mon 3, Sat 6 → Mon 2', () => {
    expect(daysUntilNextMonday(new Date(2026, 7, 5))).toBe(5); // Wed Aug 5
    expect(daysUntilNextMonday(new Date(2026, 7, 8))).toBe(2); // Sat Aug 8
  });
});

describe('streakPillCopy', () => {
  it('headlines a live streak with its day count', () => {
    expect(streakPillCopy(1, t)).toEqual({
      main: '1 day strong',
      milestone: '2 days to a 3-day bonus',
    });
    expect(streakPillCopy(5, t).main).toBe('5 days strong');
  });

  it('counts down to the next milestone while the streak lives', () => {
    expect(streakPillCopy(2, t).milestone).toBe('1 day to a 3-day bonus');
    expect(streakPillCopy(6, t).milestone).toBe('1 day to a 7-day bonus');
    expect(streakPillCopy(7, t).milestone).toBe('23 days to a 30-day bonus');
  });

  it('has no countdown past the top of the ladder or on a dead streak', () => {
    expect(streakPillCopy(365, t).milestone).toBeNull();
    expect(streakPillCopy(0, t).milestone).toBeNull();
    expect(streakPillCopy(0, t).main).toBe('Your adventure is waiting. Your next quest is ready.');
  });

  it('forwards the locale for the explicit Arabic milestone path', () => {
    expect(streakPillCopy(2, ta, 'ar').milestone).toBe('يوم واحد على مكافأة 3 أيام');
    expect(streakPillCopy(2, t).milestone).toBe('1 day to a 3-day bonus');
  });

  it('keeps tone familiar and positive (§7.5), no banned words', () => {
    const texts = [0, 1, 5, 29, 100]
      .map((n) => Object.values(streakPillCopy(n, t)).filter(Boolean).join(' '))
      .join(' ')
      .toLowerCase();
    for (const banned of ['pain', 'suffer', 'grind', 'intense', 'must', 'should']) {
      expect(texts).not.toContain(banned);
    }
  });
});

describe('trialMasteryCopy', () => {
  it('pins the 0048 contract: +60 mastery in the trial track', () => {
    expect(WEEKLY_TRIAL_MASTERY_XP).toBe(60);
  });

  it('names the active trial track under the XP line', () => {
    expect(trialMasteryCopy(t, 'trial-strength')).toBe('+60 Strength Mastery');
    expect(trialMasteryCopy(t, 'trial-endurance')).toBe('+60 Endurance Mastery');
    expect(trialMasteryCopy(t, 'trial-mobility')).toBe('+60 Mobility Mastery');
    expect(trialMasteryCopy(t, 'trial-discipline')).toBe('+60 Discipline Mastery');
  });

  it('renders in Arabic with no leaked template syntax', () => {
    const copy = trialMasteryCopy(ta, 'trial-strength');
    expect(copy).toContain('60');
    expect(copy).not.toMatch(/[{}]/);
  });
});

/**
 * S9-01 regression pins, spawn-time TZ=Asia/Tokyo: the habit surface's
 * derived states (daily cell, weekly earn-rollover, streak countdown) must
 * flip ONLY at the literal local midnight. 2026-03-08 23:59:59 JST is the
 * instant 2026-03-08T14:59:59Z and 2026-03-09 00:00 JST is 15:00:00Z — a
 * completion made in the last TZ second belongs to Mar 8, one second later
 * belongs to Mar 9. Expected keys are literal zone strings; 2026-03-02/09
 * are Mondays.
 *
 * Node only honors TZ set at process spawn, so this suite runs when
 * `TZ=Asia/Tokyo` is exported before jest starts (CI step); otherwise skip.
 */
import { dayKey } from '@/domain/streak/dayKey';
import { nextStreakMilestone } from '@/domain/streak/milestone';
import { currentStreak } from '@/domain/streak/streak';
import {
  dailyChallengeProgress,
  daysUntilNextMonday,
  weeklyEarnCopy,
} from '@/features/questBoard/earn';

const pinned = process.env.TZ === 'Asia/Tokyo' ? describe : describe.skip;

pinned('habit surface derived states under TZ=Asia/Tokyo', () => {
  it('the daily cell flips exactly at JST midnight (23:59:59 → 00:00)', () => {
    const lastSecond = new Date('2026-03-08T14:59:59Z'); // 23:59:59 JST
    const midnight = new Date('2026-03-08T15:00:00Z'); // 00:00 JST Mar 9
    expect(dayKey(lastSecond)).toBe('2026-03-08');
    expect(dayKey(midnight)).toBe('2026-03-09');

    const doneAt2359 = dailyChallengeProgress([{ dayKey: '2026-03-08' }], dayKey(lastSecond));
    const doneAt0000 = dailyChallengeProgress([{ dayKey: '2026-03-08' }], dayKey(midnight));
    expect(doneAt2359.done).toBe(true);
    expect(doneAt0000.done).toBe(false);
  });

  it('the weekly rollover countdown is 1 day at Sunday 23:59 JST, 7 at Monday 00:00', () => {
    const sundayEnd = new Date('2026-03-08T14:59:59Z'); // Sun Mar 8 23:59:59 JST
    const mondayStart = new Date('2026-03-08T15:00:00Z'); // Mon Mar 9 00:00 JST
    expect(daysUntilNextMonday(sundayEnd)).toBe(1);
    expect(daysUntilNextMonday(mondayStart)).toBe(7);

    // The earn line reflects the paid bonus and the near rollover.
    expect(weeklyEarnCopy(3, 3, daysUntilNextMonday(sundayEnd))).toBe(
      'Bonus banked — the next one starts tomorrow.',
    );
    expect(weeklyEarnCopy(3, 3, daysUntilNextMonday(mondayStart))).toBe(
      'Bonus banked — the next one starts in 7 days.',
    );
  });

  it('streak math stays key-local: consecutive JST days survive the instant boundary', () => {
    // A quest finished 23:59 JST on Mar 7 and one finished 00:00 JST Mar 9 —
    // both UTC instants fall on Mar 8 14:59/15:00 UTC, yet the local keys are
    // two different local days: the Mar 9 key is "today" for the streak.
    expect(currentStreak(['2026-03-07', '2026-03-09'], '2026-03-09')).toEqual({
      current: 1,
      longest: 1,
    });
  });

  it('the milestone countdown is zone-invariant (pure day counts)', () => {
    expect(nextStreakMilestone(6)).toEqual({ days: 7, xp: 150, daysTo: 1 });
    expect(nextStreakMilestone(29)).toEqual({ days: 30, xp: 500, daysTo: 1 });
  });
});

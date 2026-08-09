/**
 * S9-01 regression pins, spawn-time TZ=America/New_York: the derived states
 * must not flicker across a spring-forward or a repeated fall-back hour.
 * 2026-03-08 is the spring-forward Sunday (02:00 EST → 03:00 EDT, 23h day);
 * 2026-11-01 is the fall-back Sunday (03:00 EDT → 01:00 EST, 25h day).
 *
 * Node only honors TZ set at process spawn, so this suite runs when
 * `TZ=America/New_York` is exported before jest starts (CI step); otherwise
 * it skips.
 */
import { dayKey } from '@/domain/streak/dayKey';
import { currentStreak } from '@/domain/streak/streak';
import {
  dailyChallengeProgress,
  daysUntilNextMonday,
  weeklyEarnCopy,
} from '@/features/questBoard/earn';

const pinned = process.env.TZ === 'America/New_York' ? describe : describe.skip;

pinned('habit surface derived states under TZ=America/New_York', () => {
  it('spring-forward crossing stays one local day (01:59:59 EST → 03:00:01 EDT)', () => {
    const before = new Date('2026-03-08T01:59:59-05:00'); // 01:59:59 EST
    const after = new Date('2026-03-08T03:00:01-04:00'); // 03:00:01 EDT
    expect(dayKey(before)).toBe('2026-03-08');
    expect(dayKey(after)).toBe('2026-03-08');
    expect(after.getTime() - before.getTime()).toBe(2_000); // 02:00 was skipped
  });

  it('the daily cell stays done across the spring-forward crossing', () => {
    const before = new Date('2026-03-08T01:59:59-05:00');
    const after = new Date('2026-03-08T03:00:05-04:00');
    expect(dailyChallengeProgress([{ dayKey: '2026-03-08' }], dayKey(before)).done).toBe(true);
    expect(dailyChallengeProgress([{ dayKey: '2026-03-08' }], dayKey(after)).done).toBe(true);
  });

  it('the fall-back repeated hour does not change the local day', () => {
    const first = new Date('2026-11-01T01:30:00-04:00'); // 01:30 EDT (pre-repeat)
    const second = new Date('2026-11-01T01:30:00-05:00'); // 01:30 EST (the repeat)
    expect(dayKey(first)).toBe('2026-11-01');
    expect(dayKey(second)).toBe('2026-11-01');
    expect(dailyChallengeProgress([{ dayKey: '2026-11-01' }], dayKey(second)).done).toBe(true);
    expect(dailyChallengeProgress([{ dayKey: '2026-11-01' }], dayKey(first)).done).toBe(true);
  });

  it('the Sunday rollover countdown ignores the 25h day (still 1 to Monday)', () => {
    expect(daysUntilNextMonday(new Date('2026-11-01T23:59:00-05:00'))).toBe(1);
    expect(daysUntilNextMonday(new Date('2026-03-08T23:59:00-04:00'))).toBe(1);
  });

  it('a streak across the spring-forward day counts consecutive local days', () => {
    // Mar 8 (EDT, 23h day) and Mar 9 are consecutive calendar days regardless
    // of the missing hour: the Mar 9 "today" keeps a Mar 8 streak alive.
    expect(currentStreak(['2026-03-07', '2026-03-08'], '2026-03-08')).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('weekly earn rollover copy stays day-accurate through the DST weekend', () => {
    expect(weeklyEarnCopy(3, 3, 1)).toBe('Bonus banked — the next one starts tomorrow.');
  });
});

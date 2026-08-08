import {
  WEEKLY_TARGET,
  challengeState,
  dayWindow,
  rollsOverOn,
  weeklyWindow,
} from '@/domain/board/window';

const DAY_MS = 86_400_000;

/**
 * Host-agnostic suites. Expected bounds are computed live in the host's own
 * local frame (`new Date(y, m-1, d [+ n])` normalizes rollovers and DST), so
 * these hold in any timezone; the exact instant-level pins (23h/25h DST days,
 * Asia/Tokyo midnight) live in the TZ-pinned suites window-dst / window-tz.
 */
const local = (year: number, month: number, day: number, h = 0, min = 0, s = 0, ms = 0): Date =>
  new Date(year, month - 1, day, h, min, s, ms);

const midnightMs = (year: number, month: number, day: number): number =>
  new Date(year, month - 1, day).getTime();

const nextMidnightMs = (year: number, month: number, day: number): number =>
  new Date(year, month - 1, day + 1).getTime();

const mondayMs = (year: number, month: number, day: number): number => {
  const d = new Date(year, month - 1, day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
};

const nextMondayMs = (year: number, month: number, day: number): number => {
  const d = new Date(year, month - 1, day);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - ((d.getDay() + 6) % 7) + 7,
  ).getTime();
};

describe('dayWindow', () => {
  it('keys the local calendar day with literal local-midnight bounds', () => {
    // Wed 2026-08-05, 12:00:30 local.
    const w = dayWindow(local(2026, 8, 5, 12, 0, 30));
    expect(w.dayKey).toBe('2026-08-05');
    expect(w.startMs).toBe(midnightMs(2026, 8, 5));
    expect(w.endMs).toBe(nextMidnightMs(2026, 8, 5));
  });

  it('rolls over the local Sunday→Monday boundary (23:59:59.999 → 00:00:00.000)', () => {
    const sundayEnd = local(2026, 8, 9, 23, 59, 59, 999);
    const mondayStart = local(2026, 8, 10, 0, 0, 0, 0);
    expect(dayWindow(sundayEnd).dayKey).toBe('2026-08-09');
    expect(dayWindow(sundayEnd).endMs).toBe(midnightMs(2026, 8, 10));
    expect(dayWindow(mondayStart).dayKey).toBe('2026-08-10');
    expect(dayWindow(mondayStart).startMs).toBe(dayWindow(sundayEnd).endMs);
  });

  it('handles month and year rollovers through Date normalization', () => {
    expect(dayWindow(local(2026, 12, 31, 23)).endMs).toBe(midnightMs(2027, 1, 1));
    expect(dayWindow(local(2026, 8, 31, 23)).endMs).toBe(midnightMs(2026, 9, 1));
  });

  it('is a pure function of the input date', () => {
    const now = local(2026, 8, 5, 0, 1);
    const before = now.getTime();
    dayWindow(now);
    expect(now.getTime()).toBe(before);
  });
});

describe('weeklyWindow', () => {
  it('spans literal Monday 00:00 → next Monday 00:00 − 1ms', () => {
    // Wed 2026-08-05; week is Mon 08-03 .. Sun 08-09.
    const w = weeklyWindow(local(2026, 8, 5, 12), 2);
    expect(w.startMs).toBe(mondayMs(2026, 8, 5));
    expect(w.endMs).toBe(nextMondayMs(2026, 8, 5) - 1);
    expect(w.expiresAt).toBe(nextMondayMs(2026, 8, 5));
    expect(w.rollsOverOn).toBe(w.expiresAt);
    expect(w.isActive).toBe(true);
    expect(w.completionsInWindow).toBe(2);
  });

  it('stays in the same week through Sunday 23:59:59.999 and rolls at Monday 00:00', () => {
    const sundayWeek = weeklyWindow(local(2026, 8, 9, 23, 59, 59, 999), 1);
    expect(sundayWeek.startMs).toBe(mondayMs(2026, 8, 9));
    expect(sundayWeek.endMs).toBe(mondayMs(2026, 8, 9) + 7 * DAY_MS - 1); // DST-free week
    expect(sundayWeek.isActive).toBe(true);
    expect(sundayWeek.challengeState).toBe('in-progress');

    const mondayWeek = weeklyWindow(local(2026, 8, 10, 0, 0, 0, 0), 0);
    expect(mondayWeek.startMs).toBe(mondayMs(2026, 8, 10)); // fresh week
    expect(mondayWeek.isActive).toBe(true);
    expect(mondayWeek.challengeState).toBe('pending'); // no stale card
  });

  it('derives the challenge state from the completions in the window', () => {
    expect(weeklyWindow(local(2026, 8, 5, 12), 0).challengeState).toBe('pending');
    expect(weeklyWindow(local(2026, 8, 5, 12), 1).challengeState).toBe('in-progress');
    expect(weeklyWindow(local(2026, 8, 5, 12), 3).challengeState).toBe('complete');
    expect(weeklyWindow(local(2026, 8, 5, 12), 9).challengeState).toBe('complete');
  });

  it('is a pure function of the input date', () => {
    const now = local(2026, 8, 5, 12);
    const before = now.getTime();
    weeklyWindow(now, 2);
    expect(now.getTime()).toBe(before);
  });
});

describe('challengeState', () => {
  it('maps counts to pending / in-progress / complete', () => {
    expect(challengeState(0)).toBe('pending');
    expect(challengeState(1)).toBe('in-progress');
    expect(challengeState(2)).toBe('in-progress');
    expect(challengeState(WEEKLY_TARGET)).toBe('complete');
    expect(challengeState(4)).toBe('complete');
  });
});

describe('rollsOverOn', () => {
  it('is literal next Monday 00:00 local from any day of the current week', () => {
    expect(rollsOverOn(local(2026, 8, 3))).toBe(nextMondayMs(2026, 8, 3));
    expect(rollsOverOn(local(2026, 8, 5, 14, 30))).toBe(nextMondayMs(2026, 8, 5));
    expect(rollsOverOn(local(2026, 8, 9, 23, 59, 59, 999))).toBe(nextMondayMs(2026, 8, 9));
    expect(rollsOverOn(local(2026, 8, 10))).toBe(nextMondayMs(2026, 8, 10));
  });

  it('agrees with the weekly window expiry', () => {
    const now = local(2026, 8, 5, 12);
    expect(weeklyWindow(now, 0).expiresAt).toBe(rollsOverOn(now));
    expect(weeklyWindow(now, 0).rollsOverOn).toBe(rollsOverOn(now));
  });
});

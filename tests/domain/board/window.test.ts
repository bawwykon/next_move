import {
  WEEKLY_TARGET,
  challengeState,
  dayWindow,
  rollsOverOn,
  weeklyWindow,
} from '@/domain/board/window';
import { dayKeyToUtcMs } from '@/domain/streak/dayKey';

const DAY_MS = 86_400_000;

/**
 * `refMs(key)` is the domain's frame-consistent reference instant for a local
 * calendar day (same shape as mondayOfWeek/dayKeyToUtcMs use), so the window
 * bounds are asserted against it — host-independent.
 *
 * `local(y, m, d, ...)` builds a Date whose LOCAL fields match the argument —
 * this is what "local midnight"/"23:59:59.999" really means and is what the
 * boundary units must use so they hold in any timezone.
 */
const refMs = (key: string): number => dayKeyToUtcMs(key) ?? 0;
const local = (year: number, month: number, day: number, h = 0, min = 0, s = 0, ms = 0): Date =>
  new Date(year, month - 1, day, h, min, s, ms);

describe('dayWindow', () => {
  it('keys the local calendar day with one full-DAY_MS frame after its reference', () => {
    // Wed 2026-08-05, 12:00:30 local.
    const w = dayWindow(local(2026, 8, 5, 12, 0, 30));
    expect(w.dayKey).toBe('2026-08-05');
    expect(w.startMs).toBe(refMs('2026-08-05'));
    expect(w.endMs).toBe(refMs('2026-08-06'));
    expect(w.endMs - w.startMs).toBe(DAY_MS);
  });

  it('rolls over the local Sunday→Monday boundary (23:59:59.999 → 00:00:00.000)', () => {
    const sundayEnd = local(2026, 8, 9, 23, 59, 59, 999);
    const mondayStart = local(2026, 8, 10, 0, 0, 0, 0);
    expect(dayWindow(sundayEnd).dayKey).toBe('2026-08-09');
    expect(dayWindow(sundayEnd).endMs).toBe(dayWindow(mondayStart).startMs);
    expect(dayWindow(mondayStart).dayKey).toBe('2026-08-10');
    expect(dayWindow(sundayEnd).endMs - dayWindow(sundayEnd).startMs).toBe(DAY_MS);
  });

  it('keeps DST-safe spans: full DAY_MS across US DST edges because the math is calendar-based', () => {
    // 2026-03-08 spring-forward and 2026-11-01 fall-back. The window spans the
    // whole local day by calendar arithmetic on keys, never by walking wall
    // clocks, so it survives the 23h/25h days (Ref 05 §tz).
    expect(refMs('2026-03-09') - refMs('2026-03-08')).toBe(DAY_MS);
    expect(refMs('2026-11-02') - refMs('2026-11-01')).toBe(DAY_MS);
    expect(dayWindow(local(2026, 3, 8, 12)).endMs).toBe(refMs('2026-03-09'));
    expect(dayWindow(local(2026, 11, 1, 12)).endMs).toBe(refMs('2026-11-02'));
  });

  it('is a pure function of the input date', () => {
    const now = local(2026, 8, 5, 0, 1);
    const before = now.getTime();
    dayWindow(now);
    expect(now.getTime()).toBe(before);
  });
});

describe('weeklyWindow', () => {
  it('spans the Mon→Sun reference frame (7 days minus 1 ms)', () => {
    // Wed 2026-08-05; week is Mon 08-03 .. Sun 08-09.
    const w = weeklyWindow(local(2026, 8, 5, 0), 2);
    expect(w.startMs).toBe(refMs('2026-08-03'));
    expect(w.endMs).toBe(refMs('2026-08-03') + 7 * DAY_MS - 1);
    expect(w.expiresAt).toBe(refMs('2026-08-10'));
    expect(w.rollsOverOn).toBe(refMs('2026-08-10'));
    expect(w.isActive).toBe(true);
    expect(w.completionsInWindow).toBe(2);
  });

  it('rolls the next week at the local Sunday 23:59:59.999 → Monday 00:00 boundary', () => {
    const sundayEnd = local(2026, 8, 9, 23, 59, 59, 999);
    const sundayWeek = weeklyWindow(sundayEnd, 1);
    expect(sundayWeek.startMs).toBe(refMs('2026-08-03'));
    expect(sundayWeek.endMs).toBe(refMs('2026-08-10') - 1);
    expect(sundayWeek.challengeState).toBe('in-progress');

    const mondayStart = local(2026, 8, 10, 0, 0, 0, 0);
    const mondayWeek = weeklyWindow(mondayStart, 0);
    expect(mondayWeek.startMs).toBe(refMs('2026-08-10')); // fresh week
    expect(mondayWeek.endMs).toBe(refMs('2026-08-17') - 1);
    expect(mondayWeek.expiresAt).toBe(refMs('2026-08-17'));
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
  it('is next Monday of the local reference frame from any day of the current week', () => {
    expect(rollsOverOn(local(2026, 8, 3))).toBe(refMs('2026-08-10'));
    expect(rollsOverOn(local(2026, 8, 5, 14, 30))).toBe(refMs('2026-08-10'));
    expect(rollsOverOn(local(2026, 8, 9, 23, 59, 59, 999))).toBe(refMs('2026-08-10'));
    expect(rollsOverOn(local(2026, 8, 10))).toBe(refMs('2026-08-17'));
  });

  it('agrees with the weekly window expiry', () => {
    const now = local(2026, 8, 5, 12);
    expect(weeklyWindow(now, 0).expiresAt).toBe(rollsOverOn(now));
    expect(weeklyWindow(now, 0).rollsOverOn).toBe(rollsOverOn(now));
  });
});

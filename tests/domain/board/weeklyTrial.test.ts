/**
 * Big-3 WEEKLY-TRIALS — rotation pins. 2026-01-01 is a Thursday (ISO W1).
 */
import { isoWeekNumber, TRIAL_ROTATION, weeklyTrialFor } from '@/domain/board/weeklyTrial';

describe('isoWeekNumber', () => {
  it('pins known Monday-first weeks', () => {
    expect(isoWeekNumber(new Date(Date.UTC(2026, 0, 1)))).toBe(1); // Thu
    expect(isoWeekNumber(new Date(Date.UTC(2026, 0, 4)))).toBe(1); // Sun, still W1
    expect(isoWeekNumber(new Date(Date.UTC(2026, 0, 5)))).toBe(2); // Mon
    expect(isoWeekNumber(new Date(Date.UTC(2025, 11, 29)))).toBe(1); // Mon of W1'26
  });
});

describe('weeklyTrialFor', () => {
  it('opens the year on the Trial of Strength (W1)', () => {
    expect(weeklyTrialFor(new Date(Date.UTC(2026, 0, 1)))).toBe('trial-strength');
  });

  it('cycles strength → endurance → mobility → grand → strength', () => {
    const mondays = [5, 12, 19, 26].map((day) => new Date(Date.UTC(2026, 0, day)));
    expect(mondays.map(weeklyTrialFor)).toEqual([
      'trial-endurance',
      'trial-mobility',
      'trial-grand',
      'trial-strength',
    ]);
  });

  it('repeats every 4 weeks and covers the whole rotation', () => {
    const base = new Date(Date.UTC(2026, 8, 14));
    expect(weeklyTrialFor(new Date(base.getTime() + 28 * 24 * 3600 * 1000))).toBe(
      weeklyTrialFor(base),
    );
    expect([...TRIAL_ROTATION].sort()).toEqual([
      'trial-endurance',
      'trial-grand',
      'trial-mobility',
      'trial-strength',
    ]);
  });
});

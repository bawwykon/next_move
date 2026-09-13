/**
 * Big-3 WEEKLY-TRIALS — rotation pins. 2026-01-01 is a Thursday (ISO W1).
 * Dates are built in the LOCAL frame (new Date(y, m, d)): the rotation keys
 * off the local calendar date exactly like the server's day_key, so these
 * pins hold in every host time zone.
 */
import {
  isoWeekNumber,
  TRIAL_ROTATION,
  TRIAL_TRACK,
  weeklyTrialFor,
} from '@/domain/board/weeklyTrial';

describe('isoWeekNumber', () => {
  it('pins known Monday-first weeks', () => {
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1); // Thu
    expect(isoWeekNumber(new Date(2026, 0, 4))).toBe(1); // Sun, still W1
    expect(isoWeekNumber(new Date(2026, 0, 5))).toBe(2); // Mon
    expect(isoWeekNumber(new Date(2025, 11, 29))).toBe(1); // Mon of W1'26
  });
});

describe('weeklyTrialFor', () => {
  it('opens the year on the Trial of Strength (W1)', () => {
    expect(weeklyTrialFor(new Date(2026, 0, 1))).toBe('trial-strength');
  });

  it('cycles strength → endurance → mobility → discipline → strength', () => {
    const mondays = [5, 12, 19, 26].map((day) => new Date(2026, 0, day));
    expect(mondays.map(weeklyTrialFor)).toEqual([
      'trial-endurance',
      'trial-mobility',
      'trial-discipline',
      'trial-strength',
    ]);
  });

  it('repeats every 4 weeks and covers the whole rotation', () => {
    const base = new Date(2026, 8, 14);
    expect(weeklyTrialFor(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 28))).toBe(
      weeklyTrialFor(base),
    );
    expect([...TRIAL_ROTATION].sort()).toEqual([
      'trial-discipline',
      'trial-endurance',
      'trial-mobility',
      'trial-strength',
    ]);
  });

  it('maps every slot to its mastery track 1:1', () => {
    expect(TRIAL_TRACK).toEqual({
      'trial-strength': 'strength',
      'trial-endurance': 'endurance',
      'trial-mobility': 'mobility',
      'trial-discipline': 'discipline',
    });
  });
});

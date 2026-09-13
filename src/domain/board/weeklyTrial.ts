/**
 * Big-3 WEEKLY-TRIALS — deterministic 4-week rotation theming the Weekly
 * Challenge card. Display-only by owner decision: the server rule stays
 * "3 completions Mon–Sun pays +1000 XP"; only the seal art, trial title and
 * goal line rotate. The trial week follows the ISO week number (Monday-first,
 * UTC frame), so every device agrees on the active trial for a given date.
 */
export type WeeklyTrialId = 'trial-strength' | 'trial-endurance' | 'trial-mobility' | 'trial-grand';

export const TRIAL_ROTATION: readonly WeeklyTrialId[] = Object.freeze([
  'trial-strength',
  'trial-endurance',
  'trial-mobility',
  'trial-grand',
]);

/**
 * ISO-8601 week number (Monday-first) in the UTC frame — pure and
 * DST-immune by construction (calendar fields only, no instants).
 */
export function isoWeekNumber(date: Date): number {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  day.setUTCDate(day.getUTCDate() - weekday + 3); // Thursday of this week
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 4));
  const startWeekday = (yearStart.getUTCDay() + 6) % 7;
  yearStart.setUTCDate(yearStart.getUTCDate() - startWeekday + 3);
  return 1 + Math.round((day.getTime() - yearStart.getTime()) / (7 * 24 * 3600 * 1000));
}

export function weeklyTrialFor(date: Date): WeeklyTrialId {
  const index =
    (((isoWeekNumber(date) - 1) % TRIAL_ROTATION.length) + TRIAL_ROTATION.length) %
    TRIAL_ROTATION.length;
  return TRIAL_ROTATION[index] ?? 'trial-strength';
}

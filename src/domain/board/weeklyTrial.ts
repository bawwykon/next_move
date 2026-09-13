/**
 * Big-3 WEEKLY-TRIALS — deterministic 4-week rotation theming the Weekly
 * Challenge card. Display rotation is client-side, but since 0048 the
 * rotation ALSO drives a server-side +60 mastery bonus in the trial's track
 * (relaxed rule: any 3 completions that pay the weekly bonus earn it), so
 * this module is an exact contract mirror, not just a theme picker:
 * - rotation order: strength, endurance, mobility, discipline;
 * - week key: ISO-8601 week number of the LOCAL calendar date. The server
 *   scores `extract(week from day_key::date)` where day_key is the local
 *   'YYYY-MM-DD' string, so this function MUST derive the week from local
 *   calendar fields (getFullYear/getMonth/getDate) — never UTC fields, which
 *   disagree with the local date for a few hours around midnight.
 */
export type WeeklyTrialId =
  'trial-strength' | 'trial-endurance' | 'trial-mobility' | 'trial-discipline';

export const TRIAL_ROTATION: readonly WeeklyTrialId[] = Object.freeze([
  'trial-strength',
  'trial-endurance',
  'trial-mobility',
  'trial-discipline',
]);

/** Trial track each rotation slot pays its 0048 mastery bonus in. */
export const TRIAL_TRACK: Record<
  WeeklyTrialId,
  'strength' | 'endurance' | 'mobility' | 'discipline'
> = {
  'trial-strength': 'strength',
  'trial-endurance': 'endurance',
  'trial-mobility': 'mobility',
  'trial-discipline': 'discipline',
};

/**
 * ISO-8601 week number (Monday-first) of a LOCAL calendar date — pure and
 * DST-immune by construction (the Thursday-rule arithmetic runs on the
 * proleptic calendar via UTC midnight derivation, no instants involved).
 */
export function isoWeekNumber(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
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

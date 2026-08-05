import { dayKeyToUtcMs } from './dayKey';

const DAY_MS = 86_400_000;

/**
 * Monday of the local week containing the key (Mon–Sun, Ref 08 §7).
 * The key is a local calendar date, so UTC math on it is DST-safe.
 */
export function mondayOfWeek(dayKey: string): number | null {
  const utcMs = dayKeyToUtcMs(dayKey);
  if (utcMs === null) {
    return null;
  }
  const weekday = new Date(utcMs).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return utcMs - daysSinceMonday * DAY_MS;
}

/**
 * Ref 08 §7 — both keys' Mondays equal (ISO week, local).
 */
export function isSameWeek(dayKeyA: string, dayKeyB: string): boolean {
  const mondayA = mondayOfWeek(dayKeyA);
  const mondayB = mondayOfWeek(dayKeyB);
  if (mondayA === null || mondayB === null) {
    return false;
  }
  return mondayA === mondayB;
}

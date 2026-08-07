import { dayKey, dayKeyToUtcMs } from '@/domain/streak/dayKey';
import { mondayOfWeek } from '@/domain/streak/week';

/**
 * S6-02 — recurring windows in local time (FR-BOARD-6/7, FR-QUES-6, Ref 08 §7).
 *
 * All math runs in the client's local calendar frame: `dayKey(now)` gives the
 * local 'YYYY-MM-DD', and `dayKeyToUtcMs`/`mondayOfWeek` map those keys to
 * UTC-ms instants that are DST-safe for day arithmetic. `now` is always
 * injected; every function is pure and never mutates its inputs.
 */

/** Ref 08 §7 — quests per Mon–Sun window that award the weekly bonus. */
export const WEEKLY_TARGET = 3;

const DAY_MS = 86_400_000;

export interface DayWindow {
  /** Local calendar day key for `now` (YYYY-MM-DD). */
  dayKey: string;
  /** UTC-ms of this local midnight (inclusive start). */
  startMs: number;
  /** UTC-ms of the next local midnight — exclusive end of the day. */
  endMs: number;
}

/** One local calendar day, from its own midnight to the next. */
export function dayWindow(now: Date): DayWindow {
  const key = dayKey(now);
  // dayKey(now) is always well-formed, so the null branch is unreachable.
  const startMs = dayKeyToUtcMs(key) ?? 0;
  return { dayKey: key, startMs, endMs: startMs + DAY_MS };
}

export type WeeklyChallengeState = 'pending' | 'in-progress' | 'complete';

export interface WeeklyWindow {
  /** Mon 00:00 local — inclusive start. */
  startMs: number;
  /** Sun 23:59:59.999 local — inclusive end of the week. */
  endMs: number;
  /** Next Monday 00:00 local, when this window rolls over. */
  expiresAt: number;
  /** Alias of `expiresAt` for the board's rollover copy. */
  rollsOverOn: number;
  /** Whether `now` falls inside [startMs, endMs] (always true when derived from now). */
  isActive: boolean;
  challengeState: WeeklyChallengeState;
  completionsInWindow: number;
}

/**
 * FR-QUES-6 / Ref 08 §7 — the three states of the weekly challenge based on
 * how many quests have been completed inside the Mon–Sun window.
 */
export function challengeState(count: number): WeeklyChallengeState {
  if (count >= WEEKLY_TARGET) {
    return 'complete';
  }
  if (count > 0) {
    return 'in-progress';
  }
  return 'pending';
}

/**
 * The local week containing `now`: Monday 00:00 → Sunday 23:59:59.999.
 * `completionsInWindow` is read-only metadata; the state it implies is
 * derived through `challengeState`, never mutated here.
 */
export function weeklyWindow(now: Date, completionsInWindow = 0): WeeklyWindow {
  // dayKey(now) is always well-formed, so the null branch is unreachable.
  const startMs = mondayOfWeek(dayKey(now)) ?? 0;
  const endMs = startMs + 7 * DAY_MS - 1;
  const expiresAt = startMs + 7 * DAY_MS;
  const nowMs = now.getTime();
  return {
    startMs,
    endMs,
    expiresAt,
    rollsOverOn: expiresAt,
    isActive: nowMs >= startMs && nowMs <= endMs,
    challengeState: challengeState(completionsInWindow),
    completionsInWindow,
  };
}

/** Next Monday 00:00 local — the instant the current week rolls over. */
export function rollsOverOn(now: Date): number {
  // dayKey(now) is always well-formed, so the null branch is unreachable.
  const startMs = mondayOfWeek(dayKey(now)) ?? 0;
  return startMs + 7 * DAY_MS;
}

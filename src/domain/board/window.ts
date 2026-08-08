import { dayKey } from '@/domain/streak/dayKey';

/**
 * S6-02 — recurring windows in local time (FR-BOARD-6/7, FR-QUES-6, Ref 08 §7).
 *
 * Bounds are LITERAL local midnights, built from the injected `now`'s local
 * fields (`new Date(y, m, d [+ n])` normalizes month/year rollovers and DST),
 * so a day that gains/loses an hour is genuinely 23h or 25h long — and the
 * midnight-change timer really fires at local midnight on any device/zone
 * (ED-26 fix). Data membership ("done today", weekly count) keeps using the
 * local `dayKey` string via src/domain/streak, never these instants. Every
 * function is pure; `now` is always injected.
 */

/** Ref 08 §7 — quests per Mon–Sun window that award the weekly bonus. */
export const WEEKLY_TARGET = 3;

export interface DayWindow {
  /** Local calendar day key for `now` (YYYY-MM-DD). */
  dayKey: string;
  /** Literal local midnight — inclusive start. */
  startMs: number;
  /** Literal next local midnight — exclusive end of the day. */
  endMs: number;
}

/** One local calendar day, from its own midnight to the next. */
export function dayWindow(now: Date): DayWindow {
  return {
    dayKey: dayKey(now),
    startMs: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    endMs: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime(),
  };
}

export type WeeklyChallengeState = 'pending' | 'in-progress' | 'complete';

export interface WeeklyWindow {
  /** Literal Monday 00:00 local — inclusive start. */
  startMs: number;
  /** Literal Sunday 23:59:59.999 local — inclusive end of the week. */
  endMs: number;
  /** Literal next Monday 00:00 local, when this window rolls over. */
  expiresAt: number;
  /** Alias of `expiresAt` for the board's rollover copy. */
  rollsOverOn: number;
  /** Whether `now` falls inside [startMs, endMs]. */
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

/** Literal Monday 00:00 local of the week containing `now`. */
function mondayMidnightMs(now: Date): number {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday).getTime();
}

/** Literal next Monday 00:00 local — the instant the current week rolls over. */
export function rollsOverOn(now: Date): number {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday + 7).getTime();
}

/**
 * The local week containing `now`: literal Monday 00:00 → Sunday 23:59:59.999.
 * `completionsInWindow` is read-only metadata; the state it implies is
 * derived through `challengeState`, never mutated here.
 */
export function weeklyWindow(now: Date, completionsInWindow = 0): WeeklyWindow {
  const startMs = mondayMidnightMs(now);
  const expiresAt = rollsOverOn(now);
  const endMs = expiresAt - 1;
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

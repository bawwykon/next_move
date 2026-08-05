import { dayKeyToUtcMs } from './dayKey';

const DAY_MS = 86_400_000;

export interface Streak {
  current: number;
  longest: number;
}

/**
 * Ref 03 rule 2 — streak display derives from the fetched completion snapshot,
 * never cached separately. Pure: the date is injected, no clocks inside.
 *
 * `completions` is the array of completion day keys ('YYYY-MM-DD', local).
 * A day counts if it has ≥1 completion. The current streak is the consecutive
 * run ending at `todayLocalDate` — a completion "today" keeps it alive, a gap
 * yesterday ends it (current 0). Longest is the max run over all days.
 */
export function currentStreak(completions: readonly string[], todayLocalDate: string): Streak {
  const today = dayKeyToUtcMs(todayLocalDate);
  if (today === null) {
    return { current: 0, longest: 0 };
  }

  const days = Array.from(
    new Set(completions.map(dayKeyToUtcMs).filter((value): value is number => value !== null)),
  ).sort((a, b) => a - b);

  if (days.length === 0) {
    return { current: 0, longest: 0 };
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    if (days[i]! - days[i - 1]! === DAY_MS) {
      run += 1;
      if (run > longest) {
        longest = run;
      }
    } else {
      run = 1;
    }
  }

  let current = 0;
  if (days[days.length - 1] === today) {
    current = 1;
    for (let i = days.length - 2; i >= 0; i -= 1) {
      if (days[i + 1]! - days[i]! === DAY_MS) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { current, longest };
}

import { WEEKLY_TARGET } from '@/domain/board/window';
import { isSameWeek } from '@/domain/streak/week';

export { WEEKLY_TARGET };

export interface WeeklyProgress {
  done: number;
  target: number;
}

/**
 * FR-BOARD-4 — "Complete 3 quests this week" (Ref 08 §7, Mon–Sun).
 * Counts completions whose day_key falls in today's week; completions outside
 * the current week (including last week's Sun) are ignored.
 */
export function weeklyChallengeProgress(
  completions: readonly { dayKey: string | null }[],
  today: string,
): WeeklyProgress {
  const done = completions.filter((c) => c.dayKey !== null && isSameWeek(c.dayKey, today)).length;
  return { done, target: WEEKLY_TARGET };
}

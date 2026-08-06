/**
 * FR-BOARD-7 / FR-QUES-4 — quest has a completion whose day_key equals the
 * client-local today key. That quest is "Done for today" (not replayable for XP).
 */
export function isCompletedToday(
  completions: readonly { questId: string; dayKey: string | null }[],
  questId: string,
  todayKey: string,
): boolean {
  return completions.some((c) => c.questId === questId && c.dayKey === todayKey);
}

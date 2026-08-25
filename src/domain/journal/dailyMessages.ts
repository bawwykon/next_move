/**
 * PH4-02 — Daily motivational messages.
 * One random message per day, seeded by dayKey for consistency within a day.
 * Pool written by the owner (2026-08-22).
 */
export const DAILY_MESSAGES: readonly string[] = [
  'Every quest begins with one move.',
  "You don't need to be perfect. Just keep moving.",
  'Small steps still move you forward.',
  "Today's effort is tomorrow's progress.",
  'One quest is enough. Start there.',
  "Your journey doesn't need to be fast. It just needs to continue.",
  'A little progress is still progress.',
  'Show up for yourself today.',
  'The next move is yours.',
  'Keep going. Your future self is watching.',
  'Strength is built one day at a time.',
  'No need to conquer everything today. Just take the next step.',
  "You are stronger than yesterday's excuses.",
  'Every completed quest counts.',
  "Progress doesn't have to be dramatic to be real.",
  'Start where you are. Use what you can.',
  'A short workout is better than no workout.',
  'Your adventure is still moving forward.',
  'One good decision can change your whole day.',
  'Slow progress is still progress.',
  "You showed up. That's already a win.",
  'Keep building the version of yourself you want to become.',
  'Today is another chance to move forward.',
  "Don't worry about the whole journey. Focus on the next move.",
  'Consistency beats perfection.',
  'Every level starts somewhere.',
  'Take it one quest at a time.',
  "You've got another move in you.",
  'The journey continues. So do you.',
  'Your next move could be the one that changes everything.',
] as const;

/**
 * PH4-02 — deterministic pick: one message per calendar day, same for every
 * render of that day, changing at midnight. Pure derivation from
 * (pool, dayKey) — no backend, no persistence. The hash folds each character
 * so adjacent days land on different indices; modulo spreads over the pool.
 */
export function dailyMessageFor(dayKey: string): string {
  if (DAILY_MESSAGES.length === 0) {
    return '';
  }
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) % 2_147_483_647;
  }
  const index = hash % DAILY_MESSAGES.length;
  return DAILY_MESSAGES[index] ?? DAILY_MESSAGES[0]!;
}

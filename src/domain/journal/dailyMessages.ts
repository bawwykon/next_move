/**
 * PH4-02 — Daily motivational messages.
 * One random message per day, seeded by dayKey for consistency within a day.
 * Pool written by the owner (2026-08-22).
 *
 * I18N-01: the pools now live in the locale tables
 * (`board.dailyMessages`, 30 entries per locale). This module keeps the pure
 * deterministic index math; `dailyMessageKey` resolves the i18n key and the
 * UI translates it. DAILY_MESSAGES/dailyMessageFor remain as the English
 * reference used by older tests.
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
 * (pool, dayKey) — no backend, no persistence. Sequential rotation over the
 * UTC day number: adjacent days show adjacent messages and every message
 * appears exactly once per 30-day cycle (no repeats, no starvation).
 */
export function dailyMessageFor(dayKey: string): string {
  return DAILY_MESSAGES[dailyMessageIndex(dayKey)] ?? DAILY_MESSAGES[0]!;
}

/** Pure index math shared by every locale (pools must all carry 30 entries). */
export function dailyMessageIndex(dayKey: string): number {
  if (DAILY_MESSAGES.length === 0) {
    return 0;
  }
  const parts = dayKey.split('-').map(Number);
  const dayNumber = Math.floor(
    Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1) / 86_400_000,
  );
  if (!Number.isFinite(dayNumber)) {
    return 0;
  }
  return ((dayNumber % DAILY_MESSAGES.length) + DAILY_MESSAGES.length) % DAILY_MESSAGES.length;
}

/** i18n key for the day's message — the UI translates it (I18N-01). */
export function dailyMessageKey(dayKey: string): string {
  return `board.dailyMessages.${dailyMessageIndex(dayKey)}`;
}

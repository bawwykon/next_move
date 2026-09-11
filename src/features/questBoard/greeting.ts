import type { TFunction } from 'i18next';

export interface Greeting {
  greeting: string;
  line: string;
}

/**
 * FR-BOARD-1 — time-of-day greeting. Buckets: 05:00–11:59 morning,
 * 12:00–16:59 afternoon, 17:00–04:59 evening. Tone stays positive (§7.5).
 * Copy comes from the locale tables via `t` (I18N-01).
 */
export function greetingForHour(hour: number, t: TFunction): Greeting {
  if (hour >= 5 && hour < 12) {
    return {
      greeting: t('board.greeting.morning'),
      line: t('board.greeting.morningLine'),
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      greeting: t('board.greeting.afternoon'),
      line: t('board.greeting.afternoonLine'),
    };
  }
  return {
    greeting: t('board.greeting.evening'),
    line: t('board.greeting.eveningLine'),
  };
}

export interface Greeting {
  greeting: string;
  line: string;
}

/**
 * FR-BOARD-1 — time-of-day greeting. Buckets: 05:00–11:59 morning,
 * 12:00–16:59 afternoon, 17:00–04:59 evening. Tone stays positive (§7.5).
 */
export function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'Good morning',
      line: 'A fresh start — small moves count.',
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Good afternoon',
      line: 'Keep it moving — one quest is enough.',
    };
  }
  return {
    greeting: 'Good evening',
    line: 'Wind down with a gentle quest.',
  };
}

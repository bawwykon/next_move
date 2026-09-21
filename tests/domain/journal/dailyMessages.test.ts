import {
  DAILY_MESSAGES,
  dailyMessageFor,
  dailyMessageIndex,
} from '../../../src/domain/journal/dailyMessages';

describe('dailyMessageFor', () => {
  it('returns the same message for every render of one day', () => {
    const first = dailyMessageFor('2026-08-22');
    expect(dailyMessageFor('2026-08-22')).toBe(first);
    expect(dailyMessageFor('2026-08-22')).toBe(first);
  });

  it('always returns a message from the owner pool', () => {
    for (let i = 0; i < 60; i += 1) {
      const key = `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`;
      expect(DAILY_MESSAGES).toContain(dailyMessageFor(key));
    }
  });

  it('varies across consecutive days', () => {
    const picks = new Set(
      Array.from({ length: 14 }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        return dailyMessageFor(`2026-08-${day}`);
      }),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('handles an empty day key without crashing', () => {
    expect(DAILY_MESSAGES).toContain(dailyMessageFor(''));
  });

  it('rotates sequentially: consecutive days map to consecutive indices', () => {
    expect(dailyMessageIndex('2026-08-23')).toBe(
      (dailyMessageIndex('2026-08-22') + 1) % DAILY_MESSAGES.length,
    );
    expect(dailyMessageIndex('2026-09-01')).toBe(
      (dailyMessageIndex('2026-08-31') + 1) % DAILY_MESSAGES.length,
    );
  });

  it('covers every message exactly once per 30-day cycle', () => {
    const picks = new Set(
      Array.from({ length: 30 }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        return dailyMessageFor(`2026-08-${day}`);
      }),
    );
    expect(picks.size).toBe(30);
  });
});

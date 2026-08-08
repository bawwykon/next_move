/**
 * EDGE-26 regression pin, spawn-time TZ=America/New_York: window bounds are
 * LITERAL local midnights, so a DST day is genuinely 23h/25h long and the
 * rollover sits exactly on the real boundary. Expected instants are written as
 * explicit UTC-offset strings (e.g. local Mar 9 00:00 EDT = 2026-03-09T04:00Z).
 *
 * Node only honors TZ set at process spawn (jest workers start after Date is
 * first used), so this suite runs when `TZ=America/New_York` is exported
 * before jest starts (CI step); it self-skips otherwise.
 */
import { dayWindow, rollsOverOn, weeklyWindow } from '@/domain/board/window';

const pinned = process.env.TZ === 'America/New_York' ? describe : describe.skip;

pinned('window bounds under TZ=America/New_York', () => {
  it('spring-forward day 2026-03-08 is genuinely 23h (02:00 skipped)', () => {
    const w = dayWindow(new Date(2026, 2, 8, 12));
    expect(w.dayKey).toBe('2026-03-08');
    expect(w.startMs).toBe(Date.parse('2026-03-08T00:00:00-05:00')); // 00:00 EST
    expect(w.endMs).toBe(Date.parse('2026-03-09T00:00:00-04:00')); // 00:00 EDT
    expect(w.endMs - w.startMs).toBe(82_800_000); // 23h
  });

  it('fall-back day 2026-11-01 is genuinely 25h (02:00 repeated)', () => {
    const w = dayWindow(new Date(2026, 10, 1, 12));
    expect(w.dayKey).toBe('2026-11-01');
    expect(w.startMs).toBe(Date.parse('2026-11-01T00:00:00-04:00')); // 00:00 EDT
    expect(w.endMs).toBe(Date.parse('2026-11-02T00:00:00-05:00')); // 00:00 EST
    expect(w.endMs - w.startMs).toBe(90_000_000); // 25h
  });

  it('a plain day is exactly 24h', () => {
    const w = dayWindow(new Date(2026, 7, 5, 12));
    expect(w.endMs - w.startMs).toBe(86_400_000);
  });

  it('sits exactly on the real local-midnight rollover across the DST transition', () => {
    // 2026-03-08 01:59:59.999 EST is still the 08th; its end is the literal
    // Mar 9 00:00 EDT — the frame-based code could not produce this instant.
    const sundayEnd = new Date(2026, 2, 8, 1, 59, 59, 999);
    expect(dayWindow(sundayEnd).dayKey).toBe('2026-03-08');
    expect(dayWindow(sundayEnd).endMs).toBe(Date.parse('2026-03-09T00:00:00-04:00'));
    expect(dayWindow(new Date(2026, 2, 9, 0, 0, 0, 0)).startMs).toBe(
      Date.parse('2026-03-09T00:00:00-04:00'),
    );
  });

  it('a week containing spring-forward is one hour short (Mon Mar 2 → Mon Mar 9)', () => {
    const w = weeklyWindow(new Date(2026, 2, 4, 12), 2);
    expect(w.startMs).toBe(Date.parse('2026-03-02T00:00:00-05:00')); // Mon 00:00 EST
    expect(w.expiresAt).toBe(Date.parse('2026-03-09T00:00:00-04:00')); // next Mon 00:00 EDT
    expect(w.endMs).toBe(w.expiresAt - 1);
    expect(w.endMs - w.startMs).toBe(6 * 86_400_000 + 82_800_000 - 1); // 7 days − 1h − 1ms
  });

  it('rollsOverOn is the literal next Monday 00:00 local', () => {
    expect(rollsOverOn(new Date(2026, 2, 8, 12))).toBe(Date.parse('2026-03-09T00:00:00-04:00'));
  });
});

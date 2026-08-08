/**
 * EDGE-26 regression pin, spawn-time TZ=Asia/Tokyo (no DST): on a device in a
 * far-east zone the timer must fire at LITERAL local midnight — 2026-03-08
 * 00:00 JST is the instant 2026-03-07T15:00:00Z — and a plain day spans
 * exactly 24h between those real midnights. Expected instants are explicit
 * UTC-offset strings; 2026-03-02 is a Monday.
 *
 * Node only honors TZ set at process spawn, so this suite runs when
 * `TZ=Asia/Tokyo` is exported before jest starts (CI step); otherwise skip.
 */
import { dayWindow, rollsOverOn, weeklyWindow } from '@/domain/board/window';

const pinned = process.env.TZ === 'Asia/Tokyo' ? describe : describe.skip;

pinned('window bounds under TZ=Asia/Tokyo', () => {
  it('starts at the literal local midnight (00:00 JST = 15:00Z the day before)', () => {
    const w = dayWindow(new Date(2026, 2, 8, 12));
    expect(w.dayKey).toBe('2026-03-08');
    expect(w.startMs).toBe(Date.parse('2026-03-08T00:00:00+09:00')); // 00:00 JST
    expect(w.endMs).toBe(Date.parse('2026-03-09T00:00:00+09:00')); // 00:00 JST
    expect(w.endMs - w.startMs).toBe(86_400_000); // no DST in JST
  });

  it('rolls over exactly at JST midnight: Sunday 23:59:59.999 → Monday 00:00:00.000', () => {
    const sundayEnd = new Date(2026, 2, 8, 23, 59, 59, 999);
    const mondayStart = new Date(2026, 2, 9, 0, 0, 0, 0);
    expect(dayWindow(sundayEnd).endMs).toBe(mondayStart.getTime());
    expect(dayWindow(sundayEnd).endMs).toBe(Date.parse('2026-03-09T00:00:00+09:00'));
  });

  it('the weekly window uses literal Monday 00:00 JST bounds', () => {
    const w = weeklyWindow(new Date(2026, 2, 8, 12), 0); // Sun Mar 8
    expect(w.startMs).toBe(Date.parse('2026-03-02T00:00:00+09:00')); // Mon Mar 2 00:00 JST
    expect(w.expiresAt).toBe(Date.parse('2026-03-09T00:00:00+09:00')); // Mon Mar 9 00:00 JST
    expect(w.endMs).toBe(w.expiresAt - 1);
    expect(w.endMs - w.startMs).toBe(7 * 86_400_000 - 1); // DST-free week
  });

  it('rollsOverOn is the literal next Monday 00:00 JST', () => {
    expect(rollsOverOn(new Date(2026, 2, 8, 12))).toBe(Date.parse('2026-03-09T00:00:00+09:00'));
  });
});

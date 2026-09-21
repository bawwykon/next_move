import { getPlayerPosition, TRAIL_END_QUESTS, TRAIL_WAYPOINTS } from '@/domain/journey/trail';

/**
 * JOURNEY-TRAIL — chapter-paced token position. Thresholds land exactly on
 * their landmark pins; mid-chapter counts land at the true halfway of that
 * chapter's road (arc length in map space, y ×2 for the 1:2 canvas).
 */
describe('getPlayerPosition', () => {
  it('pins the trail ends', () => {
    expect(getPlayerPosition(0)).toEqual({ x: 45.6, y: 97.4 });
    expect(getPlayerPosition(TRAIL_END_QUESTS)).toEqual({ x: 52.0, y: 6.0 });
  });

  it('lands chapter thresholds exactly on their landmark pins', () => {
    expect(getPlayerPosition(10)).toEqual({ x: 49.9, y: 81.0 }); // gate arch
    expect(getPlayerPosition(30)).toEqual({ x: 46.7, y: 67.2 }); // upper flags
    expect(getPlayerPosition(60)).toEqual({ x: 32.9, y: 47.5 }); // bridge entry
    expect(getPlayerPosition(100)).toEqual({ x: 75.1, y: 31.3 }); // fortress gate
    expect(getPlayerPosition(200)).toEqual({ x: 47.4, y: 22.0 }); // switchbacks
  });

  it('walks mid-chapter counts at true road halfway (5/10 → mid-road to the arch)', () => {
    // Chapter 1 road: (45.6,97.4) → (32.0,91.6) → (49.9,81.0); half of its
    // map-space length sits 17.8% along the second leg.
    const pos = getPlayerPosition(5);
    expect(pos.x).toBeCloseTo(35.18, 1);
    expect(pos.y).toBeCloseTo(89.71, 1);
  });

  it('clamps outside the trail', () => {
    expect(getPlayerPosition(-3)).toEqual({ x: 45.6, y: 97.4 });
    expect(getPlayerPosition(999)).toEqual({ x: 52.0, y: 6.0 });
    expect(getPlayerPosition(Number.NaN)).toEqual({ x: 52.0, y: 6.0 });
  });

  it('keeps every waypoint on the trail it paces', () => {
    for (const w of TRAIL_WAYPOINTS) {
      expect(w.quest).toBeGreaterThanOrEqual(0);
      expect(w.quest).toBeLessThanOrEqual(TRAIL_END_QUESTS);
    }
  });

  it('runs in travel order: quests ascend, road climbs village → summit', () => {
    for (let i = 1; i < TRAIL_WAYPOINTS.length; i++) {
      // Strictly ascending quest labels (no backtracking the counter).
      expect(TRAIL_WAYPOINTS[i]!.quest).toBeGreaterThan(TRAIL_WAYPOINTS[i - 1]!.quest);
      // Road always climbs (y shrinks toward the peak, never dips back down).
      expect(TRAIL_WAYPOINTS[i]!.y).toBeLessThan(TRAIL_WAYPOINTS[i - 1]!.y);
    }
  });

  it('anchors every chapter threshold with a pin', () => {
    const labels = TRAIL_WAYPOINTS.map((w) => w.quest);
    for (const t of [0, 10, 30, 60, 100, 200, 365]) {
      expect(labels).toContain(t);
    }
  });
});

/**
 * JOURNEY-TRAIL — player token position along the map road.
 *
 * Pure: no mutation, no I/O. The road shape is the owner-placed pin polyline
 * (calibrated in-app via RealJourneyMap's CALIBRATE_PATH_PINS mode); pacing
 * is chapter-driven: each chapter's road sub-polyline is walked by ARC
 * LENGTH, so token speed is uniform inside a chapter and every chapter
 * threshold lands exactly on its landmark pin (gate arch, bridge entrance,
 * fortress gate…). 5/10 quests puts the token midway to the Chapter 2 gate;
 * 10/10 puts it at the arch. Waypoint `quest` labels below are polyline
 * shape anchors; do not re-tune pacing by moving them — pacing derives from
 * CHAPTERS thresholds. Distances are measured in map space (x in %width,
 * y scaled ×2 because the map canvas is 1:2).
 */
import { CHAPTERS } from '@/domain/journey/chapter';

export interface TrailWaypoint {
  quest: number;
  x: number; // percentage of map width
  y: number; // percentage of map height
}

export const TRAIL_WAYPOINTS: readonly TrailWaypoint[] = Object.freeze([
  // 1: road below the fountain
  Object.freeze({ quest: 0, x: 45.6, y: 97.4 }),
  // 2: left of the fountain plaza
  Object.freeze({ quest: 5, x: 32.0, y: 91.6 }),
  // 3: village gate arch (Chapter 2 threshold)
  Object.freeze({ quest: 10, x: 49.9, y: 81.0 }),
  // 4: training grounds, lower dummies
  Object.freeze({ quest: 20, x: 62.3, y: 75.8 }),
  // 5: training grounds, upper flags (Chapter 3 threshold)
  Object.freeze({ quest: 30, x: 46.7, y: 67.2 }),
  // 6: forest road beside the river
  Object.freeze({ quest: 42, x: 26.3, y: 63.5 }),
  // 7: winding road climbing out of the forest
  Object.freeze({ quest: 52, x: 40.1, y: 52.5 }),
  // 8: stone bridge entrance (Chapter 4 threshold)
  Object.freeze({ quest: 60, x: 32.9, y: 47.5 }),
  // 9: on the bridge
  Object.freeze({ quest: 80, x: 47.9, y: 40.9 }),
  // 10: fortress gate (Chapter 5 threshold)
  Object.freeze({ quest: 100, x: 75.1, y: 31.3 }),
  // 11: mountain staircase mid
  Object.freeze({ quest: 150, x: 43.6, y: 28.8 }),
  // 12: upper switchbacks (Chapter 6 threshold)
  Object.freeze({ quest: 200, x: 47.4, y: 22.0 }),
  // 13: road below the summit snows
  Object.freeze({ quest: 250, x: 41.6, y: 17.6 }),
  // 14: summit rocks right of the crystal approach
  Object.freeze({ quest: 290, x: 52.9, y: 11.9 }),
  // 15: below the peak (Chapter 7 threshold lives at the crystal)
  Object.freeze({ quest: 320, x: 50.4, y: 8.2 }),
  // Trail endpoint: golden crystal summit
  Object.freeze({ quest: 365, x: 52.0, y: 6.0 }),
]);

/** Highest quest count the trail maps (Mastery Peak threshold). */
export const TRAIL_END_QUESTS = 365;

function segLen(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = (by - ay) * 2;
  return Math.hypot(dx, dy);
}

/**
 * Player (x, y) in trail percentages for any quest count. Clamped to the
 * trail ends; chapter thresholds land exactly on their landmark pins.
 */
export function getPlayerPosition(questsInput: number): { x: number; y: number } {
  const quests = Number.isFinite(questsInput)
    ? Math.max(0, Math.min(TRAIL_END_QUESTS, Math.floor(questsInput)))
    : TRAIL_END_QUESTS;
  const thresholds = CHAPTERS.map((c) => c.threshold);
  // Chapter index holding `quests` (last span is 365..365 — endpoint only).
  let chapter = thresholds.length - 1;
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (quests < thresholds[i + 1]!) {
      chapter = i;
      break;
    }
  }
  const start = thresholds[chapter]!;
  const end = thresholds[chapter + 1] ?? TRAIL_END_QUESTS;
  const span = end - start;
  if (span <= 0) {
    const tip = TRAIL_WAYPOINTS[TRAIL_WAYPOINTS.length - 1]!;
    return { x: tip.x, y: tip.y };
  }
  const fraction = (quests - start) / span;
  const pts = TRAIL_WAYPOINTS.filter((w) => w.quest >= start && w.quest <= end);
  if (pts.length === 0) {
    const tip = TRAIL_WAYPOINTS[TRAIL_WAYPOINTS.length - 1]!;
    return { x: tip.x, y: tip.y };
  }
  if (pts.length === 1) {
    return { x: pts[0]!.x, y: pts[0]!.y };
  }
  let total = 0;
  const lengths: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = segLen(pts[i]!.x, pts[i]!.y, pts[i + 1]!.x, pts[i + 1]!.y);
    lengths.push(l);
    total += l;
  }
  if (total <= 0) {
    return { x: pts[0]!.x, y: pts[0]!.y };
  }
  let remaining = fraction * total;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (remaining <= l) {
      const t = l > 0 ? remaining / l : 0;
      return {
        x: pts[i]!.x + t * (pts[i + 1]!.x - pts[i]!.x),
        y: pts[i]!.y + t * (pts[i + 1]!.y - pts[i]!.y),
      };
    }
    remaining -= l;
  }
  const tip = pts[pts.length - 1]!;
  return { x: tip.x, y: tip.y };
}

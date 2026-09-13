/**
 * S8-01 — level/XP/mastery curve pins, mirror-side of the server formulas in
 * 0020: level boundaries 50·L·(L−1), mastery floor(points/250)+1 cap 10, and
 * the FR-XP-3 title ladder. AC pins: level 5 → cumulative 1000; 100→101 span
 * 10,000; clamping; fractions; ladder edges.
 */
import {
  levelTitle,
  levelXpBounds,
  masteryLevelForPoints,
  masteryProgress,
  xpProgress,
} from '@/domain/xp/level';

describe('levelXpBounds (50·L·(L−1) cumulative curve)', () => {
  it('level 1 spans 0..100', () => {
    expect(levelXpBounds(1)).toEqual({ start: 0, end: 100, span: 100 });
  });

  it('level 5 starts at cumulative 1000 (AC pin)', () => {
    expect(levelXpBounds(5)).toEqual({ start: 1000, end: 1500, span: 500 });
  });

  it('level 100 → 101 spans exactly 10,000 (AC pin)', () => {
    const bounds = levelXpBounds(100);
    expect(bounds.span).toBe(10_000);
    expect(bounds.end - bounds.start).toBe(10_000);
  });

  it('clamps sub-1 and floors fractional input', () => {
    expect(levelXpBounds(0)).toEqual(levelXpBounds(1));
    expect(levelXpBounds(-3)).toEqual(levelXpBounds(1));
    expect(levelXpBounds(2.9)).toEqual(levelXpBounds(2));
  });
});

describe('xpProgress', () => {
  it('renders a zero-state as a clean 0-fraction bar (UI AC)', () => {
    expect(xpProgress(0, 1)).toEqual({ into: 0, needed: 100, fraction: 0 });
  });

  it('halfway into level 1', () => {
    expect(xpProgress(50, 1)).toEqual({ into: 50, needed: 100, fraction: 0.5 });
  });

  it('level 2 boundary math (start = 100, span = 200)', () => {
    expect(xpProgress(150, 2)).toEqual({ into: 50, needed: 200, fraction: 0.25 });
  });

  it('clamps below the current level to 0 and above the span to 1', () => {
    expect(xpProgress(999, 5).into).toBe(0);
    expect(xpProgress(999, 5).fraction).toBe(0);
    expect(xpProgress(2500, 5).into).toBe(500);
    expect(xpProgress(2500, 5).fraction).toBe(1);
  });
});

describe('levelTitle (FR-XP-3 ladder, server mirror)', () => {
  it('anchors every rung', () => {
    expect(levelTitle(1)).toBe('Beginner');
    expect(levelTitle(4)).toBe('Beginner');
    expect(levelTitle(5)).toBe('Apprentice');
    expect(levelTitle(9)).toBe('Apprentice');
    expect(levelTitle(10)).toBe('Adventurer');
    expect(levelTitle(24)).toBe('Adventurer');
    expect(levelTitle(25)).toBe('Warrior');
    expect(levelTitle(49)).toBe('Warrior');
    expect(levelTitle(50)).toBe('Champion');
    expect(levelTitle(99)).toBe('Champion');
    expect(levelTitle(100)).toBe('Legend');
    expect(levelTitle(200)).toBe('Legend');
  });

  it('defensively handles 0 and negatives', () => {
    expect(levelTitle(0)).toBe('Beginner');
    expect(levelTitle(-5)).toBe('Beginner');
  });
});

describe('masteryLevelForPoints (Big-3 ladder 1..20, server mirror 0047)', () => {
  it('pins every band edge and the L20 cap', () => {
    expect(masteryLevelForPoints(0)).toBe(1);
    expect(masteryLevelForPoints(99)).toBe(1);
    expect(masteryLevelForPoints(100)).toBe(2);
    expect(masteryLevelForPoints(249)).toBe(2);
    expect(masteryLevelForPoints(250)).toBe(3);
    expect(masteryLevelForPoints(374)).toBe(3);
    expect(masteryLevelForPoints(375)).toBe(4);
    expect(masteryLevelForPoints(499)).toBe(4);
    expect(masteryLevelForPoints(500)).toBe(5);
    expect(masteryLevelForPoints(999)).toBe(5);
    expect(masteryLevelForPoints(1000)).toBe(6);
    expect(masteryLevelForPoints(1999)).toBe(9);
    expect(masteryLevelForPoints(2000)).toBe(10);
    expect(masteryLevelForPoints(6999)).toBe(19);
    expect(masteryLevelForPoints(7000)).toBe(20);
    expect(masteryLevelForPoints(10_000)).toBe(20);
  });
});

describe('masteryProgress', () => {
  it('renders variable bands against the next threshold', () => {
    expect(masteryProgress(0)).toEqual({ level: 1, into: 0, needed: 100, fraction: 0 });
    expect(masteryProgress(175)).toEqual({ level: 2, into: 75, needed: 150, fraction: 0.5 });
    expect(masteryProgress(1999)).toEqual({
      level: 9,
      into: 249,
      needed: 250,
      fraction: 0.996,
    });
  });

  it('renders a full bar at the L20 cap', () => {
    expect(masteryProgress(7000)).toEqual({
      level: 20,
      into: 500,
      needed: 500,
      fraction: 1,
    });
    expect(masteryProgress(10_000).fraction).toBe(1);
  });
});

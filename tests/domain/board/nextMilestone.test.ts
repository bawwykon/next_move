/**
 * Big-3 NEXT-MILESTONE — priority + boundary pins.
 * Ladders: chapters 0/10/30/60/100/200/365, player levels 100×L,
 * streak rungs 3/7/30/100/200/365.
 */
import { nextMilestone } from '@/domain/board/nextMilestone';

describe('nextMilestone priority', () => {
  it('anchors on the next chapter by default', () => {
    // 56 quests, level 4 deep (far from level-up), streak 0.
    const m = nextMilestone({ journeyQuests: 56, totalXp: 800, level: 4, streak: 0 });
    expect(m.kind).toBe('chapter');
    expect(m.ref).toBe(4);
    expect(m.remaining).toBe(4);
    expect(m.done).toBe(26);
    expect(m.target).toBe(30);
    expect(m.fraction).toBeCloseTo(26 / 30);
  });

  it('a streak rung 1–2 days out beats chapter and level', () => {
    // 1 day from the 7-rung, 20 XP from level 5 — streak still wins.
    const m = nextMilestone({ journeyQuests: 56, totalXp: 1480, level: 4, streak: 6 });
    expect(m.kind).toBe('streak');
    expect(m.ref).toBe(7);
    expect(m.remaining).toBe(1);
  });

  it('a level-up <100 XP out beats the chapter leg', () => {
    // Level 4 spans 600..1000: 920 total = 80 out.
    const m = nextMilestone({ journeyQuests: 56, totalXp: 920, level: 4, streak: 0 });
    expect(m.kind).toBe('level');
    expect(m.ref).toBe(5);
    expect(m.remaining).toBe(80);
  });

  it('past Mastery Peak the card falls back to the level leg', () => {
    const m = nextMilestone({ journeyQuests: 400, totalXp: 800, level: 4, streak: 0 });
    expect(m.kind).toBe('level');
    expect(m.ref).toBe(5);
  });
});

describe('nextMilestone boundaries', () => {
  it('a rung exactly reached is earned: looks strictly above', () => {
    const m = nextMilestone({ journeyQuests: 0, totalXp: 0, level: 1, streak: 3 });
    expect(m.kind).toBe('chapter');
  });

  it('a rung 3+ days out does not trigger the streak leg', () => {
    const m = nextMilestone({ journeyQuests: 0, totalXp: 0, level: 1, streak: 4 });
    expect(m.kind).toBe('chapter');
  });

  it('exactly 100 XP out is not "close" (<100 rule)', () => {
    // Level 4 spans 600..1000; 900 total = 100 out -> chapter leg.
    const m = nextMilestone({ journeyQuests: 0, totalXp: 900, level: 4, streak: 0 });
    expect(m.kind).toBe('chapter');
    const close = nextMilestone({ journeyQuests: 0, totalXp: 901, level: 4, streak: 0 });
    expect(close.kind).toBe('level');
    expect(close.remaining).toBe(99);
  });

  it('a banked level-up (XP past the line) still renders the level leg', () => {
    const m = nextMilestone({ journeyQuests: 0, totalXp: 1700, level: 4, streak: 0 });
    expect(m.kind).toBe('level');
    expect(m.remaining).toBe(0);
  });

  it('clamps garbage input instead of crashing', () => {
    const m = nextMilestone({ journeyQuests: -5, totalXp: -10, level: 0, streak: -2 });
    expect(m.kind).toBe('chapter');
    expect(m.remaining).toBe(10);
  });
});

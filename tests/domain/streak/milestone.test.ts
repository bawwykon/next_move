import {
  STREAK_MILESTONE_DAYS,
  STREAK_MILESTONE_XP,
  nextStreakMilestone,
  streakMilestoneXp,
} from '@/domain/streak/milestone';

describe('streakMilestoneXp', () => {
  it('mirrors the server payout table exactly (0020 §Streak milestone)', () => {
    expect(streakMilestoneXp(3)).toBe(50);
    expect(streakMilestoneXp(7)).toBe(150);
    expect(streakMilestoneXp(30)).toBe(500);
    expect(streakMilestoneXp(100)).toBe(1500);
  });

  it('pays nothing for days outside the ladder', () => {
    expect(streakMilestoneXp(1)).toBe(0);
    expect(streakMilestoneXp(31)).toBe(0);
    expect(streakMilestoneXp(0)).toBe(0);
  });

  it('keeps the ladder and the payouts index-aligned', () => {
    expect(STREAK_MILESTONE_DAYS).toEqual([3, 7, 30, 100]);
    expect(STREAK_MILESTONE_XP).toEqual([50, 150, 500, 1500]);
    expect(STREAK_MILESTONE_DAYS.length).toBe(STREAK_MILESTONE_XP.length);
  });
});

describe('nextStreakMilestone', () => {
  it('points at the first rung from zero', () => {
    const next = nextStreakMilestone(0);
    expect(next).toEqual({ days: 3, xp: 50, daysTo: 3 });
  });

  it('counts down toward the rung strictly above the current streak', () => {
    expect(nextStreakMilestone(1)).toEqual({ days: 3, xp: 50, daysTo: 2 });
    expect(nextStreakMilestone(2)).toEqual({ days: 3, xp: 50, daysTo: 1 });
    expect(nextStreakMilestone(6)).toEqual({ days: 7, xp: 150, daysTo: 1 });
    expect(nextStreakMilestone(29)).toEqual({ days: 30, xp: 500, daysTo: 1 });
    expect(nextStreakMilestone(99)).toEqual({ days: 100, xp: 1500, daysTo: 1 });
  });

  it('advances past a rung the streak already stands on', () => {
    expect(nextStreakMilestone(3)).toEqual({ days: 7, xp: 150, daysTo: 4 });
    expect(nextStreakMilestone(7)).toEqual({ days: 30, xp: 500, daysTo: 23 });
    expect(nextStreakMilestone(30)).toEqual({ days: 100, xp: 1500, daysTo: 70 });
  });

  it('has nothing to count down to at or past the top of the ladder', () => {
    expect(nextStreakMilestone(100)).toBeNull();
    expect(nextStreakMilestone(101)).toBeNull();
    expect(nextStreakMilestone(1000)).toBeNull();
  });

  it('clamps fractional and negative inputs to a whole non-negative streak', () => {
    expect(nextStreakMilestone(2.9)).toEqual({ days: 3, xp: 50, daysTo: 1 });
    expect(nextStreakMilestone(-4)).toEqual({ days: 3, xp: 50, daysTo: 3 });
  });
});

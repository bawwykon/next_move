import {
  WORLD_QUEST_POOL,
  canClaimWorldQuests,
  canRerollObjective,
  doneWorldQuestCount,
  goalForWorldQuestKey,
  isCurrentWorldQuestWeek,
  isWorldQuestKey,
  isWorldQuestsComplete,
  parseWorldQuestsWeek,
  worldQuestWeekKey,
  type WorldQuestsWeek,
} from '@/domain/worldQuests/model';

const monday = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0);
};

describe('worldQuestWeekKey', () => {
  it('returns the Monday of the local week', () => {
    // 2026-09-20 is a Sunday → Monday 2026-09-14.
    expect(worldQuestWeekKey(monday('2026-09-20'))).toBe('2026-09-14');
    // A Monday maps to itself.
    expect(worldQuestWeekKey(monday('2026-09-14'))).toBe('2026-09-14');
    // Mid-week Wednesday → same Monday.
    expect(worldQuestWeekKey(monday('2026-09-16'))).toBe('2026-09-14');
  });

  it('holds across month and year boundaries', () => {
    // 2026-01-01 is a Thursday → Monday 2025-12-29.
    expect(worldQuestWeekKey(monday('2026-01-01'))).toBe('2025-12-29');
    // Sunday 2026-08-02 → Monday 2026-07-27.
    expect(worldQuestWeekKey(monday('2026-08-02'))).toBe('2026-07-27');
  });

  it('emits zero-padded YYYY-MM-DD', () => {
    expect(worldQuestWeekKey(monday('2026-09-20'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('pool mirror', () => {
  it('deals 8 objectives with the server goals', () => {
    expect(WORLD_QUEST_POOL).toHaveLength(8);
    expect(goalForWorldQuestKey('wq_strength')).toBe(2);
    expect(goalForWorldQuestKey('wq_endurance')).toBe(2);
    expect(goalForWorldQuestKey('wq_mobility')).toBe(2);
    expect(goalForWorldQuestKey('wq_discipline')).toBe(2);
    expect(goalForWorldQuestKey('wq_any_3')).toBe(3);
    expect(goalForWorldQuestKey('wq_days_3')).toBe(3);
    expect(goalForWorldQuestKey('wq_hard_1')).toBe(1);
    expect(goalForWorldQuestKey('wq_custom_1')).toBe(1);
  });

  it('recognizes only pool keys', () => {
    expect(isWorldQuestKey('wq_strength')).toBe(true);
    expect(isWorldQuestKey('wq_bogus')).toBe(false);
    expect(isWorldQuestKey(null)).toBe(false);
    expect(isWorldQuestKey(42)).toBe(false);
  });
});

const week = (overrides: Partial<WorldQuestsWeek> = {}): WorldQuestsWeek => ({
  weekKey: '2026-09-14',
  objectives: [
    { key: 'wq_strength', goal: 2, progress: 2 },
    { key: 'wq_any_3', goal: 3, progress: 1 },
    { key: 'wq_hard_1', goal: 1, progress: 0 },
  ],
  rerollsRemaining: 2,
  completed: false,
  claimed: false,
  ...overrides,
});

describe('parseWorldQuestsWeek', () => {
  it('parses a valid ensure/reroll row', () => {
    const parsed = parseWorldQuestsWeek({
      week_key: '2026-09-14',
      objectives: [
        { key: 'wq_strength', goal: 2, progress: 1 },
        { key: 'wq_days_3', goal: 3, progress: 3 },
      ],
      rerolls_remaining: 2,
      completed: false,
      claimed: false,
    });
    expect(parsed).toEqual({
      weekKey: '2026-09-14',
      objectives: [
        { key: 'wq_strength', goal: 2, progress: 1 },
        { key: 'wq_days_3', goal: 3, progress: 3 },
      ],
      rerollsRemaining: 2,
      completed: false,
      claimed: false,
    });
  });

  it('drops unknown objective keys and rejects malformed rows', () => {
    const parsed = parseWorldQuestsWeek({
      week_key: '2026-09-14',
      objectives: [
        { key: 'wq_future', goal: 5, progress: 5 },
        { key: 'wq_any_3', goal: 3, progress: 0 },
      ],
      rerolls_remaining: 1,
      completed: false,
      claimed: false,
    });
    expect(parsed?.objectives).toEqual([{ key: 'wq_any_3', goal: 3, progress: 0 }]);
    expect(parseWorldQuestsWeek(null)).toBeNull();
    expect(parseWorldQuestsWeek({})).toBeNull();
    expect(parseWorldQuestsWeek({ week_key: '2026-09-14' })).toEqual({
      weekKey: '2026-09-14',
      objectives: [],
      rerollsRemaining: 0,
      completed: false,
      claimed: false,
    });
  });
});

describe('completion and claim gates', () => {
  it('counts met objectives and completes only at 3/3', () => {
    expect(doneWorldQuestCount(week())).toBe(1);
    expect(isWorldQuestsComplete(week())).toBe(false);
    const full = week({
      objectives: [
        { key: 'wq_strength', goal: 2, progress: 2 },
        { key: 'wq_any_3', goal: 3, progress: 3 },
        { key: 'wq_hard_1', goal: 1, progress: 1 },
      ],
    });
    expect(isWorldQuestsComplete(full)).toBe(true);
    expect(canClaimWorldQuests(full)).toBe(true);
    expect(canClaimWorldQuests({ ...full, claimed: true })).toBe(false);
    expect(isWorldQuestsComplete(week({ objectives: [] }))).toBe(false);
  });

  it('gates rerolls on spares, claim state, and unmet goals', () => {
    const w = week();
    expect(canRerollObjective(w, 1)).toBe(true);
    expect(canRerollObjective(w, 0)).toBe(false);
    expect(canRerollObjective(w, 9)).toBe(false);
    expect(canRerollObjective(week({ rerollsRemaining: 0 }), 1)).toBe(false);
    expect(canRerollObjective(week({ claimed: true }), 1)).toBe(false);
  });
});

describe('isCurrentWorldQuestWeek', () => {
  it('matches only this local week', () => {
    const today = monday('2026-09-20');
    expect(isCurrentWorldQuestWeek('2026-09-14', today)).toBe(true);
    expect(isCurrentWorldQuestWeek('2026-09-07', today)).toBe(false);
    expect(isCurrentWorldQuestWeek('not-a-key', today)).toBe(false);
  });
});

import type { CompletionResult } from '@/domain/completion/types';

import {
  breakdownRowSum,
  masteryDeltas,
  masteryLevelTitle,
  reconcileCompletion,
  unlockOverview,
  xpBreakdownRows,
  xpBreakdownTotal,
  type SyncedCompletion,
} from '@/features/victory/format';

const synced = (questId: string, result: CompletionResult): SyncedCompletion => ({
  questId,
  result,
});

const fullResult: CompletionResult = {
  xp: { quest: 50, daily: 25, weekly: 75, streak: 10, total: 160 },
  level: { before: 2, after: 3, title: 'Explorer' },
  mastery: [
    {
      track: 'strength',
      points_before: 320,
      points_after: 370,
      level_before: 1,
      level_after: 1,
    },
    {
      track: 'mobility',
      points_before: 100,
      points_after: 150,
      level_before: 1,
      level_after: 2,
    },
  ],
  journey: { quests: 4, chapter_before: 1, chapter_after: 1, next_threshold: 5 },
  streak: { current: 2, longest: 3 },
  achievements: [
    {
      id: 'a1',
      slug: 'early-bird',
      unlocked_at: '2026-07-06T07:08:00Z',
      title: 'Early Bird',
      category: 'consistency',
    },
  ],
  cosmetics: [
    {
      id: 'c1',
      slug: 'ember-band',
      unlocked_at: '2026-07-06T07:08:00Z',
      type: 'band',
      name: 'Ember Band',
    },
  ],
};

describe('xpBreakdownRows', () => {
  it('returns Quest, Daily, Weekly, Streak rows in that fixed order', () => {
    const rows = xpBreakdownRows(fullResult.xp);
    expect(rows.map((row) => row.label)).toEqual([
      'Quest',
      'Daily bonus',
      'Weekly bonus',
      'Streak bonus',
    ]);
    expect(rows.map((row) => row.xp)).toEqual([50, 25, 75, 10]);
  });

  it('drops zero-value stages so nothing paid out is hidden', () => {
    const rows = xpBreakdownRows({ quest: 50, daily: 0, weekly: 0, streak: 20, total: 70 });
    expect(rows).toEqual([
      { label: 'Quest', xp: 50 },
      { label: 'Streak bonus', xp: 20 },
    ]);
  });

  it('returns no rows when every stage paid zero', () => {
    expect(xpBreakdownRows({ quest: 0, daily: 0, weekly: 0, streak: 0, total: 0 })).toEqual([]);
  });

  it('the visible rows always sum to the authoritative total', () => {
    const xps = [
      { quest: 50, daily: 25, weekly: 75, streak: 100, total: 250 },
      { quest: 50, daily: 0, weekly: 0, streak: 0, total: 50 },
      { quest: 0, daily: 0, weekly: 0, streak: 0, total: 0 },
    ];
    for (const xp of xps) {
      expect(breakdownRowSum(xpBreakdownRows(xp))).toBe(xpBreakdownTotal(xp));
    }
  });
});

describe('masteryLevelTitle', () => {
  it('maps levels 1..5 to their titles', () => {
    expect(masteryLevelTitle(1)).toBe('Novice');
    expect(masteryLevelTitle(2)).toBe('Explorer');
    expect(masteryLevelTitle(3)).toBe('Adept');
    expect(masteryLevelTitle(4)).toBe('Expert');
    expect(masteryLevelTitle(5)).toBe('Master');
  });

  it('stays Master through the cap (10) and clamps out-of-range levels', () => {
    expect(masteryLevelTitle(6)).toBe('Master');
    expect(masteryLevelTitle(10)).toBe('Master');
    expect(masteryLevelTitle(0)).toBe('Novice');
  });
});

describe('masteryDeltas', () => {
  it('derives track labels, points gained and the level title', () => {
    const deltas = masteryDeltas(fullResult.mastery);
    expect(deltas[0]).toMatchObject({
      track: 'strength',
      trackLabel: 'Strength',
      pointsBefore: 320,
      pointsAfter: 370,
      pointsGained: 50,
      levelTitle: 'Novice',
      leveledUp: false,
    });
    expect(deltas[1]).toMatchObject({
      trackLabel: 'Mobility',
      pointsGained: 50,
      levelTitle: 'Explorer',
      leveledUp: true,
    });
  });

  it('handles an empty mastery list (no leveled tracks this run)', () => {
    expect(masteryDeltas([])).toEqual([]);
  });
});

describe('unlockOverview', () => {
  it('groups achievements and cosmetics with a combined count', () => {
    const overview = unlockOverview(fullResult);
    expect(overview.achievements).toHaveLength(1);
    expect(overview.cosmetics).toHaveLength(1);
    expect(overview.count).toBe(2);
    expect(overview.hasUnlocks).toBe(true);
  });

  it('reports no unlocks when both lists are empty', () => {
    const overview = unlockOverview({ ...fullResult, achievements: [], cosmetics: [] });
    expect(overview.count).toBe(0);
    expect(overview.hasUnlocks).toBe(false);
  });
});

describe('reconcileCompletion', () => {
  it('is not synced while the outbox flush has not landed', () => {
    expect(reconcileCompletion(null, 'q1')).toEqual({ synced: false, result: null });
  });

  it('hands over the authoritative payload once it matches the quest', () => {
    const state = reconcileCompletion(synced('q1', fullResult), 'q1');
    expect(state.synced).toBe(true);
    expect(state.result).toBe(fullResult);
  });

  it('stays pending when the stored payload belongs to another quest', () => {
    expect(reconcileCompletion(synced('q-other', fullResult), 'q1')).toEqual({
      synced: false,
      result: null,
    });
  });

  it('falls back to the stored payload when no quest id is given', () => {
    const state = reconcileCompletion(synced('q1', fullResult));
    expect(state.synced).toBe(true);
    expect(state.result).toBe(fullResult);
  });
});

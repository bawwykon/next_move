import {
  LOCKED_EMBLEM,
  lockedCopy,
  mergeCatalogWithUnlocks,
  type AchievementCatalogRow,
} from '@/domain/achievements/merge';

/** Mirror of the live seed catalogue (supabase/seed.sql) — constants only. */
const CATALOG: AchievementCatalogRow[] = [
  {
    slug: 'early-bird',
    title: 'Early Bird',
    description: 'Start 100 quests before 10:00 AM.',
    hint: 'The day starts early for some.',
    category: 'special',
  },
  {
    slug: 'first-level',
    title: 'First Level',
    description: 'Reach level 2.',
    hint: 'Every journey has its first summit.',
    category: 'beginner',
  },
  {
    slug: 'first-quest',
    title: 'First Quest',
    description: 'Complete your first quest.',
    hint: 'Take the first step.',
    category: 'beginner',
  },
  {
    slug: 'first-week',
    title: 'First Week',
    description: 'Complete quests on seven different days.',
    hint: 'A week of small wins adds up.',
    category: 'beginner',
  },
  {
    slug: 'master-adventurer',
    title: 'Master Adventurer',
    description: 'Reach level 100.',
    hint: 'The summit waits for the patient.',
    category: 'special',
  },
  {
    slug: 'night-owl',
    title: 'Night Owl',
    description: 'Start 100 quests after 8:00 PM.',
    hint: 'Night holds its own magic.',
    category: 'special',
  },
  {
    slug: 'phoenix',
    title: 'Phoenix',
    description: 'Return after a break of a week or more.',
    hint: 'Even pauses lead somewhere good.',
    category: 'special',
  },
  {
    slug: 'streak-100',
    title: '100 Day Streak',
    description: 'Keep a 100-day quest streak.',
    hint: 'A hundred days of quiet consistency.',
    category: 'consistency',
  },
  {
    slug: 'streak-30',
    title: '30 Day Streak',
    description: 'Keep a 30-day quest streak.',
    hint: 'A full month of showing up.',
    category: 'consistency',
  },
  {
    slug: 'streak-7',
    title: '7 Day Streak',
    description: 'Keep a 7-day quest streak.',
    hint: 'Seven small days, one strong chain.',
    category: 'consistency',
  },
  {
    slug: 'workouts-100',
    title: '100 Workouts',
    description: 'Complete 100 quests.',
    hint: 'Three digits to your name.',
    category: 'progress',
  },
  {
    slug: 'workouts-250',
    title: '250 Workouts',
    description: 'Complete 250 quests.',
    hint: 'Your rhythm is your own.',
    category: 'progress',
  },
  {
    slug: 'workouts-50',
    title: '50 Workouts',
    description: 'Complete 50 quests.',
    hint: 'A number worth chasing.',
    category: 'progress',
  },
];

const allLocked = () => mergeCatalogWithUnlocks(CATALOG, []);
const allUnlocked = () =>
  mergeCatalogWithUnlocks(
    CATALOG,
    CATALOG.map((row) => ({ slug: row.slug, unlockedAt: '2026-08-01T10:00:00Z' })),
  );

describe('mergeCatalogWithUnlocks', () => {
  it('at a fresh account: every row locked, in catalogue order, hint present, no unlock date', () => {
    const rows = allLocked();
    expect(rows).toHaveLength(13);
    expect(rows.every((row) => row.state === 'locked')).toBe(true);
    expect(rows.map((row) => row.slug)).toEqual(CATALOG.map((row) => row.slug));
    for (const row of rows) {
      expect(typeof row.hint).toBe('string');
      expect(row.unlockedAt).toBeUndefined();
      expect(row.description).not.toBeNull();
    }
  });

  it('with a full unlock: every row unlocked, hint absent, dates in place', () => {
    const rows = allUnlocked();
    expect(rows.every((row) => row.state === 'unlocked')).toBe(true);
    for (const row of rows) {
      expect(row.hint).toBeUndefined();
      expect(row.unlockedAt).toBe('2026-08-01T10:00:00Z');
    }
  });

  it('orders unlocked first, stable catalogue order within each group', () => {
    const rows = mergeCatalogWithUnlocks(CATALOG, [
      { slug: 'night-owl', unlockedAt: '2026-07-01T00:00:00Z' },
      { slug: 'first-quest', unlockedAt: '2026-06-01T00:00:00Z' },
      { slug: 'phoenix', unlockedAt: '2026-06-02T00:00:00Z' },
    ]);
    const states = rows.map((row) => row.state);
    expect(states).toEqual([
      'unlocked',
      'unlocked',
      'unlocked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    // unlocked group keeps catalogue order regardless of unlock order
    expect(rows.slice(0, 3).map((row) => row.slug)).toEqual([
      'first-quest',
      'night-owl',
      'phoenix',
    ]);
    expect(rows.slice(3).map((row) => row.slug)).toEqual(
      CATALOG.filter((row) => !['first-quest', 'night-owl', 'phoenix'].includes(row.slug)).map(
        (row) => row.slug,
      ),
    );
  });

  it('is pure: does not mutate inputs and hands out fresh objects', () => {
    const catalogCopy = CATALOG.map((row) => ({ ...row }));
    const unlockCopy = [{ slug: 'first-quest', unlockedAt: '2026-01-01T00:00:00Z' }];
    const rows = mergeCatalogWithUnlocks(CATALOG, unlockCopy);
    expect(CATALOG.map((row) => ({ ...row }))).toEqual(catalogCopy);
    expect(unlockCopy).toEqual([{ slug: 'first-quest', unlockedAt: '2026-01-01T00:00:00Z' }]);
    const unlocked = rows.find((row) => row.slug === 'first-quest')!;
    expect(unlocked).not.toBe(CATALOG.find((row) => row.slug === 'first-quest'));
  });

  it('ignores unlock slugs not in the catalogue', () => {
    const rows = mergeCatalogWithUnlocks(CATALOG, [
      { slug: 'does-not-exist', unlockedAt: '2026-01-01T00:00:00Z' },
    ]);
    expect(rows.every((row) => row.state === 'locked')).toBe(true);
  });
});

describe('lockedCopy', () => {
  it('always renders the permanent "?" emblems and the vague hint, never a trigger', () => {
    expect(lockedCopy('A week of small wins adds up.')).toEqual({
      emblem: LOCKED_EMBLEM,
      hint: 'A week of small wins adds up.',
    });
    expect(LOCKED_EMBLEM).toBe('?');
  });

  it('falls back deterministically when the hint is null so locked still renders something kind', () => {
    const first = lockedCopy(null);
    const second = lockedCopy(null);
    expect(first).toEqual(second);
    expect(first.hint).toBe('Some things reveal themselves in time.');
  });
});

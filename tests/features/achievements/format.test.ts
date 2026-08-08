import {
  LOCKED_EMBLEM,
  lockedRowStrings,
  unlockedLabel,
  unlockedRowStrings,
  ACHIEVEMENT_CATEGORY_ART,
} from '@/features/achievements/format';
import { mergeCatalogWithUnlocks, type AchievementCatalogRow } from '@/domain/achievements/merge';

/** Copy of the live seed catalogue (supabase/seed.sql) — constants only. */
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

describe('ACHIEVEMENT_CATEGORY_ART', () => {
  it('covers exactly the four schema categories with a distinct emblem each', () => {
    expect(Object.keys(ACHIEVEMENT_CATEGORY_ART).sort()).toEqual([
      'beginner',
      'consistency',
      'progress',
      'special',
    ]);
    for (const art of Object.values(ACHIEVEMENT_CATEGORY_ART)) {
      expect(art.icon).toBeTruthy();
      expect(art.iconColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(art.blobColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('unlockedLabel', () => {
  it('renders a deterministic timestamp label (no locale/clock dependence)', () => {
    expect(unlockedLabel('2026-08-08T11:54:11.903648+00:00')).toBe('Unlocked Aug 8, 2026');
    expect(unlockedLabel('2026-01-02T23:59:59Z')).toBe('Unlocked Jan 2, 2026');
    expect(unlockedLabel('2025-12-31T00:00:00Z')).toBe('Unlocked Dec 31, 2025');
  });

  it('degrades empty on broken input', () => {
    expect(unlockedLabel('not-a-date')).toBe('');
  });
});

describe('locked render surface (FR-ACH-4)', () => {
  it('a locked row renders exactly: emblem "?", title, vague hint — no description', () => {
    const rows = mergeCatalogWithUnlocks(CATALOG, []);
    expect(rows).toHaveLength(13);
    for (const row of rows) {
      const strings = lockedRowStrings(row);
      expect(strings).toHaveLength(3);
      expect(strings[0]).toBe(LOCKED_EMBLEM);
      expect(strings[1]).toBe(row.title);
      expect(strings[2]).toBe(row.hint);
    }
  });

  it('LEAK GUARD: none of the locked strings exposes the machine-readable rule syntax', () => {
    const rows = mergeCatalogWithUnlocks(CATALOG, []);
    // The trigger rules are stored as JSON with these exact lowercase keys
    // (0022): kind/count/level/days/hour/chapter/distinct/gap (+ unlock_rule
    // column name). Prose may talk around them ('Level', '50') — the guard
    // pins the JSON-key spellings and braces/quotes, the leak vector.
    const ruleSyntax =
      /"kind"|"count"|"days"|"level"|"hour"|"chapter"|"distinct"|"gap"|"unlock_rule"|\{|\}|>=|<=/;
    for (const row of rows) {
      for (const text of lockedRowStrings(row)) {
        expect(text).not.toMatch(ruleSyntax);
      }
    }
  });

  it('unlocked rows render title + description + unlock date', () => {
    const rows = mergeCatalogWithUnlocks(CATALOG, [
      { slug: 'first-quest', unlockedAt: '2026-08-08T11:54:11.903648+00:00' },
    ]);
    const firstQuest = rows.find((row) => row.slug === 'first-quest')!;
    const strings = unlockedRowStrings(firstQuest);
    expect(strings).toEqual(['First Quest', 'Complete your first quest.', 'Unlocked Aug 8, 2026']);
    expect(unlockedRowStrings(mergeCatalogWithUnlocks(CATALOG, [])[0]!)).toEqual([
      'Early Bird',
      'Start 100 quests before 10:00 AM.',
      '',
    ]);
  });
});

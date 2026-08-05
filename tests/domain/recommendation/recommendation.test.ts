import {
  alternatives,
  gentleReturnRecommendation,
  hasCompletedHardQuest,
  recommendQuest,
  recommendedDifficulty,
  rotationRecommendation,
} from '../../../src/domain/recommendation/recommendQuest';
import { planSummary, planSummaryLines } from '../../../src/domain/recommendation/plan';
import type {
  CompletionRecord,
  MasterySummary,
  OnboardingAnswers,
  QuestCatalogEntry,
} from '../../../src/domain/recommendation/types';

const catalog: QuestCatalogEntry[] = [
  {
    id: 'q-s-e-1',
    slug: 'q-s-e-1',
    difficulty: 'easy',
    durationSec: 300,
    categories: ['strength'],
  },
  {
    id: 'q-s-e-2',
    slug: 'q-s-e-2',
    difficulty: 'easy',
    durationSec: 900,
    categories: ['strength'],
  },
  { id: 'q-s-n', slug: 'q-s-n', difficulty: 'normal', durationSec: 900, categories: ['strength'] },
  { id: 'q-s-h', slug: 'q-s-h', difficulty: 'hard', durationSec: 1200, categories: ['strength'] },
  { id: 'q-e-e', slug: 'q-e-e', difficulty: 'easy', durationSec: 400, categories: ['endurance'] },
  { id: 'q-e-n', slug: 'q-e-n', difficulty: 'normal', durationSec: 900, categories: ['endurance'] },
  {
    id: 'q-m-e-1',
    slug: 'q-m-e-1',
    difficulty: 'easy',
    durationSec: 300,
    categories: ['mobility'],
  },
  {
    id: 'q-m-e-2',
    slug: 'q-m-e-2',
    difficulty: 'easy',
    durationSec: 420,
    categories: ['mobility'],
  },
  { id: 'q-m-n', slug: 'q-m-n', difficulty: 'normal', durationSec: 800, categories: ['mobility'] },
  { id: 'q-d-e', slug: 'q-d-e', difficulty: 'easy', durationSec: 300, categories: ['discipline'] },
  {
    id: 'q-d-n',
    slug: 'q-d-n',
    difficulty: 'normal',
    durationSec: 700,
    categories: ['discipline'],
  },
  { id: 'q-d-h', slug: 'q-d-h', difficulty: 'hard', durationSec: 1000, categories: ['discipline'] },
];

const mastery: MasterySummary = {
  points: { strength: 0, endurance: 0, mobility: 0, discipline: 0 },
};

const onboarding: OnboardingAnswers = {
  activity_level: 2,
  experience: 2,
  goals: ['build_a_habit'],
  workout_time: 'any',
};

const DAY_MS = 86_400_000;

function completion(questId: string, daysAgo: number): CompletionRecord {
  const quest = catalog.find((entry) => entry.id === questId);
  if (!quest) {
    throw new Error(`unknown quest ${questId}`);
  }
  return {
    questId,
    category: quest.categories[0]!,
    completedAt: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
    dayKey: `day-${daysAgo}`,
  };
}

function manyCompletions(count: number, day: number): CompletionRecord[] {
  return Array.from({ length: count }, (_, index) =>
    completion(index % 2 === 0 ? 'q-s-e-1' : 'q-e-e', Math.max(1, day - index)),
  );
}

describe('gentleReturnRecommendation', () => {
  it('returns a short easy quest with mobility bias after a 2+ day gap', () => {
    const now = new Date();
    const last = new Date(now.getTime() - 3 * DAY_MS);
    expect(gentleReturnRecommendation(now, last, catalog)).toBe('q-m-e-1');
  });

  it('returns null when the gap is under 2 days', () => {
    const now = new Date();
    const last = new Date(now.getTime() - DAY_MS);
    expect(gentleReturnRecommendation(now, last, catalog)).toBeNull();
  });

  it('returns null when there is no prior completion', () => {
    expect(gentleReturnRecommendation(new Date(), null, catalog)).toBeNull();
  });

  it('returns null when no short easy quest exists', () => {
    const now = new Date();
    const last = new Date(now.getTime() - 3 * DAY_MS);
    const noShortEasy = catalog.filter(
      (quest) => quest.difficulty !== 'easy' || quest.durationSec > 600,
    );
    expect(gentleReturnRecommendation(now, last, noShortEasy)).toBeNull();
  });
});

describe('rotationRecommendation', () => {
  it('picks the category least completed in the 3-day window', () => {
    const recent = [completion('q-s-e-1', 1), completion('q-s-e-1', 2), completion('q-e-e', 1)];
    const questId = rotationRecommendation(recent, mastery, catalog);
    expect(questId).toBe('q-m-e-1');
  });

  it('picks the least-completed track when counts tie', () => {
    const lowMastery: MasterySummary = {
      points: { strength: 0, endurance: 0, mobility: 0, discipline: 10 },
    };
    const recent = [completion('q-s-e-1', 1), completion('q-e-e', 1)];
    expect(rotationRecommendation(recent, lowMastery, catalog)).toBe('q-m-e-1');
  });

  it('picks the never-completed quest over a recently completed one in the category', () => {
    const recent = [
      completion('q-s-e-1', 1),
      completion('q-s-e-1', 2),
      completion('q-e-e', 1),
      completion('q-e-e', 1),
      completion('q-d-e', 1),
      completion('q-d-e', 1),
      completion('q-m-e-1', 1),
    ];
    expect(rotationRecommendation(recent, mastery, catalog)).toBe('q-m-e-2');
  });

  it('is deterministic across calls and catalog order', () => {
    const recent = [completion('q-s-e-1', 1), completion('q-e-e', 2)];
    const shuffled = [...catalog].reverse();
    const first = rotationRecommendation(recent, mastery, catalog);
    const second = rotationRecommendation(recent, mastery, shuffled);
    expect(first).toBe(second);
    expect(first).not.toBeNull();
  });

  it('returns null for an empty catalog', () => {
    expect(rotationRecommendation([], mastery, [])).toBeNull();
  });
});

describe('recommendedDifficulty ladder', () => {
  const oddDay = new Date(2026, 0, 5);
  const evenDay = new Date(2026, 0, 6);

  it('is easy for the first 7 lifetime completions', () => {
    expect(recommendedDifficulty(7, false, evenDay)).toBe('easy');
    expect(recommendedDifficulty(0, false, evenDay)).toBe('easy');
  });

  it('is normal for 8–20 completions regardless of day', () => {
    expect(recommendedDifficulty(8, false, evenDay)).toBe('normal');
    expect(recommendedDifficulty(20, true, evenDay)).toBe('normal');
  });

  it('is normal on odd days from 21+ completions', () => {
    expect(recommendedDifficulty(21, false, oddDay)).toBe('normal');
    expect(recommendedDifficulty(100, true, oddDay)).toBe('normal');
  });

  it('is hard on even days from 21+ before elite thresholds', () => {
    expect(recommendedDifficulty(21, false, evenDay)).toBe('hard');
    expect(recommendedDifficulty(29, true, evenDay)).toBe('hard');
  });

  it('never recommends elite without a completed hard quest', () => {
    expect(recommendedDifficulty(30, false, evenDay)).toBe('hard');
    expect(recommendedDifficulty(40, false, evenDay)).toBe('hard');
  });

  it('is elite only at 30+ completions with a completed hard quest on an even day', () => {
    expect(recommendedDifficulty(30, true, evenDay)).toBe('elite');
    expect(recommendedDifficulty(30, true, oddDay)).toBe('normal');
    expect(recommendedDifficulty(29, true, evenDay)).toBe('hard');
  });
});

describe('hasCompletedHardQuest', () => {
  it('detects a hard quest completion', () => {
    expect(hasCompletedHardQuest([completion('q-s-h', 1)], catalog)).toBe(true);
    expect(hasCompletedHardQuest([completion('q-s-e-1', 1)], catalog)).toBe(false);
  });
});

describe('recommendQuest pipeline', () => {
  it('gives gentle return priority over rotation', () => {
    const now = new Date();
    const recent = [completion('q-s-e-1', 3)];
    expect(recommendQuest(now, onboarding, mastery, recent, catalog)).toBe('q-m-e-1');
  });

  it('recommends a normal-difficulty quest in the rotated category at 12 completions', () => {
    const now = new Date();
    const recent = manyCompletions(12, 1);
    const questId = recommendQuest(now, onboarding, mastery, recent, catalog);
    const quest = catalog.find((entry) => entry.id === questId);
    expect(quest).toBeDefined();
    expect(quest!.categories).toContain('mobility');
    expect(quest!.difficulty).toBe('normal');
  });

  it('falls back to an available tier when the ladder tier is missing in the category', () => {
    const now = new Date(2026, 0, 6);
    const recent = manyCompletions(25, 1);
    const questId = recommendQuest(now, onboarding, mastery, recent, catalog);
    const quest = catalog.find((entry) => entry.id === questId);
    expect(quest!.categories).toContain('mobility');
    expect(quest!.difficulty).toBe('normal');
  });

  it('returns a hard quest on an even day at 25+ completions with a hard completed', () => {
    const now = new Date(2026, 0, 6);
    const recent = [
      ...manyCompletions(24, 2),
      completion('q-s-h', 1),
      completion('q-m-e-1', 1),
      completion('q-m-e-1', 1),
    ];
    const questId = recommendQuest(now, onboarding, mastery, recent, catalog);
    expect(catalog.find((entry) => entry.id === questId)!.difficulty).toBe('hard');
  });

  it('is deterministic end to end', () => {
    const now = new Date(2026, 0, 6);
    const recent = manyCompletions(9, 2);
    const first = recommendQuest(now, onboarding, mastery, recent, catalog);
    const second = recommendQuest(now, onboarding, mastery, recent, [...catalog].reverse());
    expect(first).toBe(second);
  });

  it('returns null for an empty catalog', () => {
    expect(recommendQuest(new Date(), onboarding, mastery, [], [])).toBeNull();
  });
});

describe('alternatives', () => {
  it('returns up to 3 alternatives from distinct categories, never the primary', () => {
    const recent = [completion('q-m-e-1', 1)];
    const picks = alternatives('q-m-e-1', recent, mastery, catalog);
    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
    expect(picks).not.toContain('q-m-e-1');
    const categories = picks.map((id) => catalog.find((entry) => entry.id === id)!.categories[0]);
    expect(new Set(categories).size).toBe(3);
  });

  it('returns fewer alternatives when fewer categories are available', () => {
    const narrow = catalog.filter((quest) => quest.categories.includes('strength'));
    const picks = alternatives('q-s-e-1', [], mastery, narrow);
    expect(picks).toHaveLength(0);
  });
});

describe('planSummary', () => {
  it('maps build_a_habit to discipline and mobility', () => {
    const summary = planSummary({ ...onboarding, goals: ['build_a_habit'] });
    expect(summary.focusAreas).toEqual(['discipline', 'mobility']);
  });

  it('maps get_stronger to strength', () => {
    expect(planSummary({ ...onboarding, goals: ['get_stronger'] }).focusAreas).toEqual([
      'strength',
    ]);
  });

  it('maps more_energy to endurance', () => {
    expect(planSummary({ ...onboarding, goals: ['more_energy'] }).focusAreas).toEqual([
      'endurance',
    ]);
  });

  it('maps feel_better and move_easier to mobility', () => {
    const summary = planSummary({ ...onboarding, goals: ['feel_better', 'move_easier'] });
    expect(summary.focusAreas).toEqual(['mobility']);
  });

  it('unions focus areas across goals', () => {
    const summary = planSummary({ ...onboarding, goals: ['get_stronger', 'more_energy'] });
    expect(summary.focusAreas).toEqual(['strength', 'endurance']);
  });

  it('falls back to a balanced plan for empty goals', () => {
    const summary = planSummary({ ...onboarding, goals: [] });
    expect(summary.focusAreas).toEqual(['mobility', 'discipline']);
  });

  it('fixes the starting difficulty and rhythm copy', () => {
    const summary = planSummary(onboarding);
    expect(summary.startingDifficulty).toMatch(/^Easy — your first 7 quests/);
    expect(summary.rhythm).toMatch(/3–5 quests a week/);
  });

  it('renders friendly completion lines with no banned tone words', () => {
    const lines = planSummaryLines(onboarding);
    expect(lines.heading).toBe('Your plan is ready.');
    expect(lines.focusLine).toBe('Focus: Discipline · Mobility');
    expect(lines.difficultyLine).toContain('Easy');
    expect(lines.rhythmLine).toContain('rest days');
    const banned = ['intense', 'painful', 'grind', 'suffer'];
    const allText = Object.values(lines).join(' ');
    for (const word of banned) {
      expect(allText.toLowerCase()).not.toContain(word);
    }
  });
});

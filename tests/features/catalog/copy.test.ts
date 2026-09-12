/**
 * CATALOG-01 — bundled quest/chapter copy lookups. Asserts the real English
 * tables, slug passthrough for unknown/custom content, and chapter parity
 * between the reference data and the locale tables.
 */
import { CHAPTER_DATA, localizeChapterData } from '@/features/journey/journeyData';
import {
  achievementCategory,
  achievementDescription,
  achievementHint,
  achievementRarity,
  achievementTitle,
  chapterFlavor,
  chapterName,
  exerciseInstruction,
  exerciseName,
  exerciseSafety,
  questDescription,
  questTitle,
} from '@/features/catalog/copy';
import { englishT } from '../../i18n/testLocale';
import type { TFunction } from 'i18next';

let t: TFunction;
beforeAll(async () => {
  t = await englishT();
});

describe('questTitle / questDescription', () => {
  it('resolves known slugs from the tables', () => {
    expect(questTitle('home-circuit', 'Home Circuit', t)).toBe('Home Circuit');
    expect(questDescription('desk-break', 'fallback', t)).toBe(
      'Quick, desk-friendly moves to refresh your body between tasks.',
    );
  });

  it('passes unknown slugs through in English (custom/future content)', () => {
    expect(questTitle('my-leg-day', 'My Leg Day', t)).toBe('My Leg Day');
    expect(questDescription('my-leg-day', 'Custom mix', t)).toBe('Custom mix');
  });

  it('passes null slugs and null fallbacks through untouched', () => {
    expect(questTitle(null, 'Adventurer Mix', t)).toBe('Adventurer Mix');
    expect(questTitle(null, null, t)).toBeNull();
    expect(questDescription(undefined, null, t)).toBeNull();
  });

  it('covers every seeded quest slug', () => {
    const slugs = [
      'morning-stretch',
      'first-steps',
      'desk-break',
      'home-circuit',
      'steady-flow',
      'power-walk',
      'core-basics',
      'full-body-flow',
      'interval-boost',
      'strength-builder',
      'interval-peak',
    ];
    for (const slug of slugs) {
      expect(questTitle(slug, 'x', t)).not.toBe('x');
      expect(questDescription(slug, 'x', t)).not.toBe('x');
    }
  });
});

describe('exerciseName / exerciseInstruction / exerciseSafety', () => {
  it('resolves known slugs from the tables', () => {
    expect(exerciseName('squat', 'Squat', t)).toBe('Squat');
    expect(exerciseInstruction('plank', 'x', t)).toContain('plank');
    expect(exerciseSafety('burpees', 'x', t)).toContain('bent knees');
  });

  it('passes unknown slugs and nulls through', () => {
    expect(exerciseName('my-move', 'My Move', t)).toBe('My Move');
    expect(exerciseInstruction(null, 'Do it', t)).toBe('Do it');
    expect(exerciseSafety(undefined, null, t)).toBeNull();
  });

  it('covers all 20 seeded exercise slugs', () => {
    const slugs = [
      'wall-push-up',
      'glute-bridge',
      'bird-dog',
      'seated-leg-raise',
      'wall-sit',
      'march-in-place',
      'step-touch',
      'gentle-hops',
      'seated-march',
      'neck-shoulder-rolls',
      'cat-cow',
      'seated-hamstring-stretch',
      'standing-quad-stretch',
      'squat',
      'push-up',
      'lunges',
      'plank',
      'bicycle-crunch',
      'mountain-climber',
      'burpees',
    ];
    for (const slug of slugs) {
      expect(exerciseName(slug, 'x', t)).not.toBe('x');
      expect(exerciseInstruction(slug, 'x', t)).not.toBe('x');
      expect(exerciseSafety(slug, 'x', t)).not.toBe('x');
    }
  });
});

describe('achievementTitle / achievementDescription / achievementHint', () => {
  it('resolves known slugs, passes unknown through', () => {
    expect(achievementTitle('phoenix', 'Phoenix', t)).toBe('Phoenix');
    expect(achievementDescription('first-quest', 'x', t)).toBe('Complete your first quest.');
    expect(achievementHint('streak-7', 'x', t)).toBe('Seven small days, one strong chain.');
    expect(achievementTitle('custom-feat', 'My Feat', t)).toBe('My Feat');
    expect(achievementTitle(null, 'Fallback', t)).toBe('Fallback');
  });

  it('localizes rarity and category labels, passes unknown through', () => {
    expect(achievementRarity('Epic', t)).toBe('Epic');
    expect(achievementRarity('Legendary', t)).toBe('Legendary');
    expect(achievementRarity('Mythic', t)).toBe('Mythic');
    expect(achievementCategory('consistency', t)).toBe('Consistency');
    expect(achievementCategory('weird', t)).toBe('weird');
  });
});

describe('chapterName / chapterFlavor / localizeChapterData', () => {
  it('resolves the seven chapters from the tables', () => {
    expect(chapterName(1, 'The First Step', t)).toBe('The First Step');
    expect(chapterFlavor(7, 'x', t)).toContain('mountain');
  });

  it('localizes rows while keeping ids and thresholds reference-identical', () => {
    const localized = localizeChapterData(t);
    expect(localized).toHaveLength(CHAPTER_DATA.length);
    for (let i = 0; i < CHAPTER_DATA.length; i++) {
      expect(localized[i]!.id).toBe(CHAPTER_DATA[i]!.id);
      expect(localized[i]!.threshold).toBe(CHAPTER_DATA[i]!.threshold);
      expect(localized[i]!.name).toBe(CHAPTER_DATA[i]!.name);
    }
    expect(localized[0]!.requirement).toBe('Complete 1 quest');
    expect(localized[1]!.requirement).toBe('Reach 10 quests to unlock');
  });
});

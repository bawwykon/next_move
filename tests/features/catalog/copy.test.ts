/**
 * CATALOG-01 — bundled quest/chapter copy lookups. Asserts the real English
 * tables, slug passthrough for unknown/custom content, and chapter parity
 * between the reference data and the locale tables.
 */
import { CHAPTER_DATA, localizeChapterData } from '@/features/journey/journeyData';
import { chapterFlavor, chapterName, questDescription, questTitle } from '@/features/catalog/copy';
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

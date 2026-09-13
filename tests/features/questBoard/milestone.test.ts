/**
 * Big-3 NEXT-MILESTONE — board copy resolves through the locale tables
 * (I18N-01) for all three legs.
 */
import type { TFunction } from 'i18next';

import { englishT } from '../../i18n/testLocale';
import { milestoneCopy } from '@/features/questBoard/milestone';

let t: TFunction;
beforeAll(async () => {
  t = await englishT();
});

describe('milestoneCopy', () => {
  it('renders the chapter leg with the localized chapter name', () => {
    const copy = milestoneCopy(
      { kind: 'chapter', done: 26, target: 30, remaining: 4, fraction: 26 / 30, ref: 4 },
      t,
    );
    expect(copy.kicker).toBe('Next Milestone');
    expect(copy.line).toBe('4 more quests to reach Chapter 4: Crossing the Bridge');
    expect(copy.meta).toBe('26 / 30 quests');
  });

  it('renders the level leg with the target rank title', () => {
    const copy = milestoneCopy(
      { kind: 'level', done: 320, target: 400, remaining: 80, fraction: 0.8, ref: 5 },
      t,
    );
    expect(copy.line).toBe('80 XP to reach Level 5 (Apprentice)');
    expect(copy.meta).toBe('320 / 400 XP');
  });

  it('renders the streak leg against the rung', () => {
    const copy = milestoneCopy(
      { kind: 'streak', done: 6, target: 7, remaining: 1, fraction: 6 / 7, ref: 7 },
      t,
    );
    expect(copy.line).toBe('1 more day to the 7-day streak badge');
    expect(copy.meta).toBe('6 / 7 days');
  });
});

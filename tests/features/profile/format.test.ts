/**
 * S8-01 — profile page display helpers (pure). Pins the XP bar rows, streak
 * copy (FR-STR-2), mastery bars, loadout resolution with defaults, history
 * day labels and paging exhaustion.
 */
import {
  achievementsEntry,
  dayLabel,
  formatXp,
  historyExhausted,
  historyLines,
  levelLine,
  loadoutSlots,
  masteryRows,
  pickerRowStrings,
  LOCKED_PICKER_EMBLEM,
  streakCopy,
  streakMilestoneLine,
  xpBar,
} from '@/features/profile/format';
import { streakPillCopy } from '@/features/questBoard/earn';
import { arabicT, englishT } from '../../i18n/testLocale';
import type { TFunction } from 'i18next';

let t: TFunction;
let ta: TFunction;
beforeAll(async () => {
  t = await englishT();
  ta = await arabicT();
});

const CATALOG = [
  { id: 'c-frame', slug: 'frame-default', name: 'Classic Frame' },
  { id: 'c-nameplate', slug: 'nameplate-level-05', name: 'Bronze Nameplate' },
  { id: 'c-portrait', slug: 'portrait-default', name: 'Classic Portrait' },
];

describe('formatXp', () => {
  it('groups thousands without locale', () => {
    expect(formatXp(0)).toBe('0');
    expect(formatXp(999)).toBe('999');
    expect(formatXp(1000)).toBe('1,000');
    expect(formatXp(12345)).toBe('12,345');
    expect(formatXp(123456)).toBe('123,456');
  });
});

describe('xpBar', () => {
  it('zero-state renders a clean start (UI AC)', () => {
    expect(xpBar(0, 1)).toEqual({ intoXp: 0, neededXp: 100, totalXp: 0, fraction: 0 });
  });

  it('derives into/needed from the server curve', () => {
    expect(xpBar(1200, 5)).toEqual({ intoXp: 200, neededXp: 500, totalXp: 1200, fraction: 0.4 });
  });
});

describe('levelLine', () => {
  it('pairs the level with its FR-XP-3 title', () => {
    expect(levelLine(1, t)).toBe('Level 1 · Beginner');
    expect(levelLine(10, t)).toBe('Level 10 · Adventurer');
    expect(levelLine(100, t)).toBe('Level 100 · Legend');
  });
});

describe('streakCopy (FR-STR-2)', () => {
  it('encourages an active streak', () => {
    expect(streakCopy(1, 3, t)).toEqual({ primary: '1 day strong', longest: 'Best: 3' });
    expect(streakCopy(3, 3, t)).toEqual({ primary: '3 days strong', longest: null });
  });

  it('never blames a missed day', () => {
    expect(streakCopy(0, 0, t).primary).toBe(
      'Your adventure is waiting. Your next quest is ready.',
    );
    expect(streakCopy(0, 0, t).longest).toBeNull();
    expect(streakCopy(0, 12, t).longest).toBe('Best: 12 days');
  });
});

describe('streakMilestoneLine (S9-02, shared with the board pill)', () => {
  it('counts whole days down to the next paid milestone', () => {
    expect(streakMilestoneLine(1, t)).toBe('2 days to a 3-day bonus');
    expect(streakMilestoneLine(2, t)).toBe('1 day to a 3-day bonus');
    expect(streakMilestoneLine(5, t)).toBe('2 days to a 7-day bonus');
    expect(streakMilestoneLine(7, t)).toBe('23 days to a 30-day bonus');
    expect(streakMilestoneLine(29, t)).toBe('1 day to a 30-day bonus');
    expect(streakMilestoneLine(99, t)).toBe('1 day to a 100-day bonus');
    expect(streakMilestoneLine(100, t)).toBe('100 days to a 200-day bonus');
    expect(streakMilestoneLine(200, t)).toBe('165 days to a 365-day bonus');
  });

  it('says nothing once the ladder is exhausted', () => {
    expect(streakMilestoneLine(365, t)).toBeNull();
    expect(streakMilestoneLine(366, t)).toBeNull();
  });

  it('resolves Arabic without the plural resolver (Hermes-safe explicit path)', async () => {
    // Fresh start: dedicated non-redundant phrasing, not "3 على مكافأة 3".
    expect(streakMilestoneLine(0, ta, 'ar')).toBe('أكمل 3 أيام متتالية لتحصل على المكافأة');
    expect(streakMilestoneLine(5, ta, 'ar')).toBe('يومان على مكافأة 7 أيام');
    expect(streakMilestoneLine(29, ta, 'ar')).toBe('يوم واحد على مكافأة 30 يومًا');
    expect(streakMilestoneLine(99, ta, 'ar')).toBe('يوم واحد على مكافأة 100 يومًا');
    expect(streakMilestoneLine(199, ta, 'ar')).toBe('يوم واحد على مكافأة 200 يومًا');
    expect(streakMilestoneLine(364, ta, 'ar')).toBe('يوم واحد على مكافأة 365 يومًا');
    expect(streakMilestoneLine(365, ta, 'ar')).toBeNull();
  });

  it('matches the board pill wording exactly (unified string)', () => {
    const { milestone } = streakPillCopy(2, t);
    expect(milestone).toBe(streakMilestoneLine(2, t));
  });
});

describe('masteryRows', () => {
  it('renders all four tracks in fixed order with level math', () => {
    const rows = masteryRows(
      [
        { track: 'discipline', points: 499 },
        { track: 'strength', points: 0 },
      ],
      t,
    );
    expect(rows.map((row) => row.track)).toEqual([
      'strength',
      'endurance',
      'mobility',
      'discipline',
    ]);
    const strength = rows[0]!;
    expect(strength.level).toBe(1);
    expect(strength.levelTitle).toBe('Novice');
    expect(strength.fraction).toBe(0);
    const discipline = rows[3]!;
    expect(discipline.points).toBe(499);
    expect(discipline.level).toBe(4);
    expect(discipline.levelTitle).toBe('Apprentice');
    expect(discipline.into).toBe(124);
    expect(discipline.fraction).toBeCloseTo(0.992);
  });
});

describe('loadoutSlots (FR-PROF-2, defaults when unset)', () => {
  it('resolves equipped ids and falls back to seeded defaults', () => {
    const slots = loadoutSlots({ frame: 'c-frame', nameplate: null, portrait: null }, CATALOG);
    expect(slots).toEqual([
      { slot: 'Frame', name: 'Classic Frame' },
      { slot: 'Nameplate', name: null },
      { slot: 'Portrait', name: 'Classic Portrait' },
    ]);
  });

  it('uses the catalogue name for an equipped non-default item', () => {
    const slots = loadoutSlots({ frame: null, nameplate: 'c-nameplate', portrait: null }, CATALOG);
    expect(slots[1]).toEqual({ slot: 'Nameplate', name: 'Bronze Nameplate' });
  });

  it('unknown ids resolve to none', () => {
    const slots = loadoutSlots({ frame: 'ghost', nameplate: null, portrait: null }, CATALOG);
    expect(slots[0]).toEqual({ slot: 'Frame', name: null });
  });
});

describe('dayLabel', () => {
  it('marks today and yesterday, else a plain date', () => {
    expect(dayLabel('2026-08-08', '2026-08-08', t)).toBe('Today');
    expect(dayLabel('2026-08-07', '2026-08-08', t)).toBe('Yesterday');
    expect(dayLabel('2026-07-30', '2026-08-08', t)).toBe('Jul 30');
    expect(dayLabel(null, '2026-08-08', t)).toBe('—');
  });
});

describe('historyLines', () => {
  it('maps every completion, skipping nothing', () => {
    const lines = historyLines(
      [
        { questTitle: 'Morning Stretch', dayKey: '2026-08-08', xp: 50 },
        { questTitle: null, dayKey: '2026-07-30', xp: 75 },
      ],
      '2026-08-08',
      t,
    );
    expect(lines).toEqual([
      { questTitle: 'Morning Stretch', dayLabel: 'Today', xp: 50 },
      { questTitle: null, dayLabel: 'Jul 30', xp: 75 },
    ]);
  });
});

describe('historyExhausted', () => {
  it('exhausted only when the fetched page came back short', () => {
    expect(historyExhausted(19, 20)).toBe(true);
    expect(historyExhausted(20, 20)).toBe(false);
    expect(historyExhausted(0, 20)).toBe(true);
  });
});

describe('achievementsEntry', () => {
  it('counts unlocks with singular/plural copy', () => {
    expect(achievementsEntry(1, t)).toBe('1 unlock earned');
    expect(achievementsEntry(13, t)).toBe('13 unlocks earned');
  });
});

describe('pickerRowStrings (S8-02, FR-COS-2)', () => {
  it('owned items render just their name; unowned ones get the ? emblem', () => {
    expect(pickerRowStrings({ owned: true, name: 'Adventurer' })).toEqual(['Adventurer']);
    expect(pickerRowStrings({ owned: false, name: 'Level 100 Frame' })).toEqual([
      LOCKED_PICKER_EMBLEM,
      'Level 100 Frame',
    ]);
  });

  it('LEAK GUARD: picker rows can never render the machine-readable rule syntax', () => {
    const ruleSyntax =
      /"kind"|"count"|"days"|"level"|"hour"|"chapter"|"distinct"|"gap"|"unlock_rule"|\{|\}|>=|<=/;
    const owned = ['Classic Frame', 'Adventurer', 'Classic Portrait'];
    const locked = ['Level 5 Frame', 'Explorer', 'Chapter 2 Scene', 'Phoenix Portrait'];
    for (const name of [...owned, ...locked]) {
      for (const text of pickerRowStrings({ owned: owned.includes(name), name })) {
        expect(text).not.toMatch(ruleSyntax);
      }
    }
  });
});

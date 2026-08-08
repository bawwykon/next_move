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
  streakCopy,
  xpBar,
} from '@/features/profile/format';

const CATALOG = [
  { id: 'c-frame', slug: 'frame-default', name: 'Classic Frame' },
  { id: 'c-title', slug: 'title-adventurer', name: 'Adventurer' },
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
    expect(levelLine(1)).toBe('Level 1 · Beginner');
    expect(levelLine(10)).toBe('Level 10 · Adventurer');
    expect(levelLine(100)).toBe('Level 100 · Legend');
  });
});

describe('streakCopy (FR-STR-2)', () => {
  it('encourages an active streak', () => {
    expect(streakCopy(1, 3)).toEqual({ primary: '1 day strong', longest: 'Best: 3' });
    expect(streakCopy(3, 3)).toEqual({ primary: '3 days strong', longest: null });
  });

  it('never blames a missed day', () => {
    expect(streakCopy(0, 0).primary).toBe('Your adventure is waiting. Your next quest is ready.');
    expect(streakCopy(0, 0).longest).toBeNull();
    expect(streakCopy(0, 12).longest).toBe('Best: 12 days');
  });
});

describe('masteryRows', () => {
  it('renders all four tracks in fixed order with level math', () => {
    const rows = masteryRows([
      { track: 'discipline', points: 499 },
      { track: 'strength', points: 0 },
    ]);
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
    expect(discipline.level).toBe(2);
    expect(discipline.levelTitle).toBe('Explorer');
    expect(discipline.into).toBe(249);
    expect(discipline.fraction).toBeCloseTo(0.996);
  });
});

describe('loadoutSlots (FR-PROF-2, defaults when unset)', () => {
  it('resolves equipped ids and falls back to seeded defaults', () => {
    const slots = loadoutSlots(
      { frame: 'c-frame', title: null, background: null, portrait: null },
      CATALOG,
    );
    expect(slots).toEqual([
      { slot: 'Frame', name: 'Classic Frame' },
      { slot: 'Title', name: null },
      { slot: 'Background', name: null },
      { slot: 'Portrait', name: 'Classic Portrait' },
    ]);
  });

  it('uses the catalogue name for an equipped non-default item', () => {
    const slots = loadoutSlots(
      { frame: null, title: 'c-title', background: null, portrait: null },
      CATALOG,
    );
    expect(slots[1]).toEqual({ slot: 'Title', name: 'Adventurer' });
  });

  it('unknown ids resolve to none', () => {
    const slots = loadoutSlots(
      { frame: 'ghost', title: null, background: null, portrait: null },
      CATALOG,
    );
    expect(slots[0]).toEqual({ slot: 'Frame', name: null });
  });
});

describe('dayLabel', () => {
  it('marks today and yesterday, else a plain date', () => {
    expect(dayLabel('2026-08-08', '2026-08-08')).toBe('Today');
    expect(dayLabel('2026-08-07', '2026-08-08')).toBe('Yesterday');
    expect(dayLabel('2026-07-30', '2026-08-08')).toBe('Jul 30');
    expect(dayLabel(null, '2026-08-08')).toBe('—');
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
    expect(achievementsEntry(1)).toBe('1 unlock earned');
    expect(achievementsEntry(13)).toBe('13 unlocks earned');
  });
});

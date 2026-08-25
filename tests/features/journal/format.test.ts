import type { JournalRow } from '../../../src/data/repositories/journal';
import { journalDayLabel, journalSections } from '../../../src/features/journal/format';

function row(overrides: Partial<JournalRow>): JournalRow {
  return {
    questTitle: 'First Steps',
    completedAt: '2026-08-22T09:00:00Z',
    dayKey: '2026-08-22',
    durationSec: 480,
    xp: 50,
    masteredTracks: [],
    ...overrides,
  };
}

describe('journalDayLabel', () => {
  it('labels today, yesterday, and older days as "Mon D"', () => {
    expect(journalDayLabel('2026-08-22', '2026-08-22')).toBe('Today');
    expect(journalDayLabel('2026-08-21', '2026-08-22')).toBe('Yesterday');
    expect(journalDayLabel('2026-08-06', '2026-08-22')).toBe('Aug 6');
    expect(journalDayLabel(null, '2026-08-22')).toBe('—');
  });
});

describe('journalSections', () => {
  it('groups entries by day, newest day first, preserving session order', () => {
    const sections = journalSections(
      [
        row({
          questTitle: 'Evening Quest',
          dayKey: '2026-08-22',
          completedAt: '2026-08-22T18:00:00Z',
        }),
        row({ dayKey: '2026-08-22', completedAt: '2026-08-22T09:00:00Z' }),
        row({
          questTitle: 'Older Quest',
          dayKey: '2026-08-21',
          completedAt: '2026-08-21T10:00:00Z',
        }),
      ],
      '2026-08-22',
    );
    expect(sections).toHaveLength(2);
    expect(sections[0]!.dayLabel).toBe('Today');
    expect(sections[0]!.entries.map((entry) => entry.title)).toEqual([
      'Evening Quest',
      'First Steps',
    ]);
    expect(sections[1]!.dayLabel).toBe('Yesterday');
  });

  it('formats the meta line as duration · XP · mastered tracks', () => {
    const [section] = journalSections(
      [row({ durationSec: 480, xp: 50, masteredTracks: ['strength'] })],
      '2026-08-22',
    );
    expect(section!.entries[0]!.metaLine).toBe('8 min · +50 XP · Strength up');
  });

  it('omits the mastery suffix when nothing leveled up and handles missing duration', () => {
    const [section] = journalSections([row({ durationSec: null, xp: 30 })], '2026-08-22');
    expect(section!.entries[0]!.metaLine).toBe('+30 XP');
  });

  it('falls back to a calm title when the join misses', () => {
    const [section] = journalSections([row({ questTitle: null })], '2026-08-22');
    expect(section!.entries[0]!.title).toBe('A quest completed');
  });
});

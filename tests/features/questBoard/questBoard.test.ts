import { colors } from '@/lib/theme';
import { greetingForHour } from '@/features/questBoard/greeting';
import { difficultyBadge } from '@/features/questBoard/badges';
import { formatDuration } from '@/features/questBoard/format';
import { weeklyChallengeProgress, WEEKLY_TARGET } from '@/features/questBoard/weekly';
import { isCompletedToday } from '@/features/questBoard/completedToday';

describe('greetingForHour', () => {
  it('returns morning copy for 5:00–11:59', () => {
    for (const hour of [5, 8, 11]) {
      const g = greetingForHour(hour);
      expect(g.greeting).toBe('Good morning');
    }
  });

  it('returns afternoon copy for 12:00–16:59', () => {
    for (const hour of [12, 14, 16]) {
      const g = greetingForHour(hour);
      expect(g.greeting).toBe('Good afternoon');
    }
  });

  it('returns evening copy for 17:00–04:59', () => {
    for (const hour of [17, 21, 23, 0, 4]) {
      const g = greetingForHour(hour);
      expect(g.greeting).toBe('Good evening');
    }
  });

  it('varies the supporting line by time of day', () => {
    const lines = [5, 12, 17].map((h) => greetingForHour(h).line);
    expect(new Set(lines).size).toBe(3);
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('keeps tone familiar and positive (§7.5), no banned words', () => {
    for (const hour of [5, 12, 17]) {
      const { greeting, line } = greetingForHour(hour);
      const text = `${greeting} ${line}`.toLowerCase();
      for (const banned of ['pain', 'suffer', 'grind', 'intense']) {
        expect(text).not.toContain(banned);
      }
    }
  });
});

describe('difficultyBadge', () => {
  it('maps every difficulty to a friendly label', () => {
    expect(difficultyBadge('easy').label).toBe('A gentle start');
    expect(difficultyBadge('normal').label).toBe('A steady step');
    expect(difficultyBadge('hard').label).toBe('A real challenge');
    expect(difficultyBadge('elite').label).toBe('The big one');
  });

  it('maps theme colors: easy calm, normal rewardStrong, hard/elite danger', () => {
    expect(difficultyBadge('easy').color).toBe(colors.calm);
    expect(difficultyBadge('normal').color).toBe(colors.rewardStrong);
    expect(difficultyBadge('hard').color).toBe(colors.danger);
    expect(difficultyBadge('elite').color).toBe(colors.danger);
  });

  it('never returns a raw hex through the payload source of truth', () => {
    for (const d of ['easy', 'normal', 'hard', 'elite'] as const) {
      const badge = difficultyBadge(d);
      expect(Object.values(colors)).toContain(badge.color);
      expect(badge.label.toLowerCase()).not.toMatch(/\b(danger|intense)\b/);
    }
  });
});

describe('formatDuration', () => {
  it('formats seeded durations to whole minutes', () => {
    expect(formatDuration(480)).toBe('8 min');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatDuration(720)).toBe('12 min');
    expect(formatDuration(900)).toBe('15 min');
    expect(formatDuration(1200)).toBe('20 min');
  });

  it('rounds to nearest minute and floors negatives to zero', () => {
    expect(formatDuration(599)).toBe('10 min');
    expect(formatDuration(61)).toBe('1 min');
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(-30)).toBe('0 min');
  });
});

describe('weeklyChallengeProgress', () => {
  const week = (key: string) => ({ dayKey: key });

  it('counts all completions inside the current week', () => {
    // Wed 2026-08-05; week is Mon 08-03 .. Sun 08-09
    const progress = weeklyChallengeProgress(
      [week('2026-08-03'), week('2026-08-05'), week('2026-08-05')],
      '2026-08-05',
    );
    expect(progress.done).toBe(3);
    expect(progress.target).toBe(WEEKLY_TARGET);
  });

  it('ignores completions from the previous week (Sun boundary)', () => {
    const progress = weeklyChallengeProgress(
      [week('2026-08-02'), week('2026-08-03'), week('2026-08-05')],
      '2026-08-05',
    );
    expect(progress.done).toBe(2);
  });

  it('treats Monday as the start of a new week', () => {
    // Mon 2026-08-10; Sunday 08-09 belongs to the prior week
    const progress = weeklyChallengeProgress(
      [week('2026-08-09'), week('2026-08-10')],
      '2026-08-10',
    );
    expect(progress.done).toBe(1);
  });

  it('counts each completion, including several on the same day', () => {
    const progress = weeklyChallengeProgress(
      [week('2026-08-05'), week('2026-08-05')],
      '2026-08-05',
    );
    expect(progress.done).toBe(2);
  });

  it('ignores malformed and null day keys', () => {
    const progress = weeklyChallengeProgress(
      [{ dayKey: null }, week('not-a-date'), week('2026-08-05'), { dayKey: '2026-13-99' }],
      '2026-08-05',
    );
    expect(progress.done).toBe(1);
  });
});

describe('isCompletedToday', () => {
  const completions = [
    { questId: 'first-steps', dayKey: '2026-08-05' },
    { questId: 'home-circuit', dayKey: '2026-08-04' },
    { questId: 'steady-flow', dayKey: null },
  ];

  it('is true when the quest has a completion on the given today key', () => {
    expect(isCompletedToday(completions, 'first-steps', '2026-08-05')).toBe(true);
  });

  it('is false when the quest was completed on another day', () => {
    expect(isCompletedToday(completions, 'home-circuit', '2026-08-05')).toBe(false);
  });

  it('is false for quests without a completion', () => {
    expect(isCompletedToday(completions, 'power-walk', '2026-08-05')).toBe(false);
  });

  it('is false when the completion has no day_key', () => {
    expect(isCompletedToday(completions, 'steady-flow', '2026-08-05')).toBe(false);
  });
});

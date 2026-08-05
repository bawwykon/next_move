import { currentStreak } from '../../../src/domain/streak/streak';
import { dayKey } from '../../../src/domain/streak/dayKey';
import { isSameWeek, mondayOfWeek } from '../../../src/domain/streak/week';

describe('currentStreak', () => {
  it('is 0/0 with no completions', () => {
    expect(currentStreak([], '2026-08-05')).toEqual({ current: 0, longest: 0 });
  });

  it('is 1/1 with only today completed', () => {
    expect(currentStreak(['2026-08-05'], '2026-08-05')).toEqual({ current: 1, longest: 1 });
  });

  it('is 2/2 with yesterday and today completed', () => {
    expect(currentStreak(['2026-08-04', '2026-08-05'], '2026-08-05')).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('resets current on a gap but preserves longest', () => {
    const completions = ['2026-08-05', '2026-08-04', '2026-08-02', '2026-08-01', '2026-07-31'];
    expect(currentStreak(completions, '2026-08-05')).toEqual({ current: 2, longest: 3 });
  });

  it('is 0 current when today is not yet completed', () => {
    expect(currentStreak(['2026-08-04'], '2026-08-05')).toEqual({ current: 0, longest: 1 });
  });

  it('counts a 7-day run as 7', () => {
    const days = [
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ];
    expect(currentStreak(days, '2026-08-05')).toEqual({ current: 7, longest: 7 });
  });

  it('dedupes multiple completions on the same day', () => {
    expect(
      currentStreak(['2026-08-05', '2026-08-05', '2026-08-05', '2026-08-04'], '2026-08-05'),
    ).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it('ignores malformed keys', () => {
    expect(currentStreak(['not-a-key', '2026-08-04'], '2026-08-05')).toEqual({
      current: 0,
      longest: 1,
    });
  });

  it('does not count future completions in current', () => {
    expect(currentStreak(['2026-08-06'], '2026-08-05')).toEqual({ current: 0, longest: 1 });
  });

  it('handles a run spanning a month boundary', () => {
    expect(
      currentStreak(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02'], '2026-08-02'),
    ).toEqual({ current: 4, longest: 4 });
  });
});

describe('dayKey', () => {
  it('formats local date with zero padding', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('isSameWeek', () => {
  it('is true within the same Mon–Sun week', () => {
    expect(isSameWeek('2026-08-03', '2026-08-09')).toBe(true);
    expect(isSameWeek('2026-08-03', '2026-08-03')).toBe(true);
  });

  it('is false across a Sunday→Monday boundary', () => {
    expect(isSameWeek('2026-08-09', '2026-08-10')).toBe(false);
  });

  it('treats the week as starting Monday', () => {
    expect(isSameWeek('2026-08-02', '2026-08-03')).toBe(false);
    expect(isSameWeek('2026-08-02', '2026-08-01')).toBe(true);
  });

  it('spans year boundaries correctly', () => {
    expect(isSameWeek('2026-12-28', '2027-01-03')).toBe(true);
    expect(isSameWeek('2027-01-03', '2027-01-04')).toBe(false);
  });

  it('returns false for malformed keys', () => {
    expect(isSameWeek('bad', '2026-08-03')).toBe(false);
  });

  it('mondayOfWeek returns the Monday of the key week', () => {
    expect(mondayOfWeek('2026-08-05')).toBe(Date.UTC(2026, 7, 3));
    expect(mondayOfWeek('2027-01-03')).toBe(Date.UTC(2026, 11, 28));
  });
});

import { formatXp } from '../../src/lib/format';

describe('formatXp', () => {
  it('formats thousands with a comma separator', () => {
    expect(formatXp(1200)).toBe('1,200 XP');
  });

  it('leaves small values unseparated', () => {
    expect(formatXp(0)).toBe('0 XP');
    expect(formatXp(42)).toBe('42 XP');
  });

  it('formats large values fully', () => {
    expect(formatXp(999999)).toBe('999,999 XP');
  });
});

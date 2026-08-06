import { formatCountdown, formatTotalRemaining } from '@/features/timer/format';

describe('formatCountdown', () => {
  it('zero-pads single digits', () => {
    expect(formatCountdown(0)).toBe('00');
    expect(formatCountdown(3)).toBe('03');
    expect(formatCountdown(5)).toBe('05');
    expect(formatCountdown(9)).toBe('09');
  });

  it('keeps two-digit values as-is', () => {
    expect(formatCountdown(10)).toBe('10');
    expect(formatCountdown(12)).toBe('12');
    expect(formatCountdown(45)).toBe('45');
    expect(formatCountdown(99)).toBe('99');
  });

  it('passes three-digit values through', () => {
    expect(formatCountdown(120)).toBe('120');
    expect(formatCountdown(600)).toBe('600');
  });

  it('floors fractional seconds', () => {
    expect(formatCountdown(9.99)).toBe('09');
    expect(formatCountdown(1.1)).toBe('01');
  });

  it('clamps negatives to 00', () => {
    expect(formatCountdown(-4)).toBe('00');
  });
});

describe('formatTotalRemaining', () => {
  it('formats zero as 00:00', () => {
    expect(formatTotalRemaining(0)).toBe('00:00');
  });

  it('rounds partial seconds up', () => {
    expect(formatTotalRemaining(999)).toBe('00:01');
    expect(formatTotalRemaining(60_001)).toBe('01:01');
  });

  it('formats mm:ss from milliseconds', () => {
    expect(formatTotalRemaining(754_000)).toBe('12:34');
    expect(formatTotalRemaining(60_000)).toBe('01:00');
    expect(formatTotalRemaining(1_234_567)).toBe('20:35');
  });

  it('handles totals of a minute or more', () => {
    expect(formatTotalRemaining(3_600_000)).toBe('60:00');
    expect(formatTotalRemaining(7_200_000)).toBe('120:00');
    expect(formatTotalRemaining(5_940_000)).toBe('99:00');
  });

  it('clamps negatives to 00:00', () => {
    expect(formatTotalRemaining(-500)).toBe('00:00');
  });
});

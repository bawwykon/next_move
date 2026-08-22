import { pausedNow, shiftStartForResume } from '@/features/workout/pause';

describe('pausedNow', () => {
  it('passes the live clock through when not paused', () => {
    expect(pausedNow(1_000, null)).toBe(1_000);
    expect(pausedNow(999_999, null)).toBe(999_999);
  });

  it('clamps ticks after the pause instant to the pause instant', () => {
    expect(pausedNow(50_000, 40_000)).toBe(40_000);
    expect(pausedNow(40_001, 40_000)).toBe(40_000);
  });

  it('never moves the clock backwards past the pause instant', () => {
    expect(pausedNow(39_999, 40_000)).toBe(39_999);
    expect(pausedNow(40_000, 40_000)).toBe(40_000);
  });
});

describe('shiftStartForResume', () => {
  it('shifts the start forward by exactly the pause length', () => {
    expect(shiftStartForResume(10_000, 60_000, 90_000)).toBe(40_000);
  });

  it('treats a zero-length pause as a no-op', () => {
    expect(shiftStartForResume(10_000, 60_000, 60_000)).toBe(10_000);
  });

  it('guards against a resume timestamp earlier than the pause', () => {
    expect(shiftStartForResume(10_000, 60_000, 50_000)).toBe(10_000);
  });

  it('keeps long pauses exact (backgrounded while paused)', () => {
    const startedAt = 1_755_000_000_000;
    const pausedAt = startedAt + 120_000;
    const resumedAt = pausedAt + 45 * 60_000;
    expect(shiftStartForResume(startedAt, pausedAt, resumedAt)).toBe(startedAt + 45 * 60_000);
  });
});

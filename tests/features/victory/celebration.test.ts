import {
  celebrateStep,
  initialCelebrationState,
  type CelebrationState,
} from '@/features/victory/celebration';

describe('celebration queue (FR-VIC-4)', () => {
  it('plays the full sequence: payload → level-up → hide (final)', () => {
    let state = celebrateStep(initialCelebrationState, 'payload');
    expect(state).toEqual({ stage: 'celebrating', confettiRun: 1, overlayVisible: false });

    state = celebrateStep(state, 'level-up');
    expect(state).toEqual({ stage: 'level-up', confettiRun: 2, overlayVisible: true });

    state = celebrateStep(state, 'hide');
    expect(state).toEqual({ stage: 'final', confettiRun: 2, overlayVisible: false });
  });

  it('skips straight to final from celebrating: confetti dismissed', () => {
    const state = celebrateStep(initialCelebrationState, 'payload');
    expect(celebrateStep(state, 'skip')).toEqual({
      stage: 'final',
      confettiRun: 0,
      overlayVisible: false,
    });
  });

  it('skips straight to final from level-up: overlay dismissed, confetti cleared', () => {
    let state = celebrateStep(initialCelebrationState, 'payload');
    state = celebrateStep(state, 'level-up');
    expect(celebrateStep(state, 'skip')).toEqual({
      stage: 'final',
      confettiRun: 0,
      overlayVisible: false,
    });
  });

  it('is a no-op before anything plays (still syncing)', () => {
    const state = celebrateStep(initialCelebrationState, 'skip');
    expect(state).toBe(initialCelebrationState);
  });

  it('stays final once skipped — in-flight timed events cannot resume the queue', () => {
    let state = celebrateStep(initialCelebrationState, 'payload');
    state = celebrateStep(state, 'skip');
    expect(celebrateStep(state, 'level-up')).toBe(state);
    expect(celebrateStep(state, 'hide')).toBe(state);
    expect(celebrateStep(state, 'skip')).toBe(state);
  });

  it('ignores out-of-order level-up events before the payload', () => {
    const state = celebrateStep(initialCelebrationState, 'level-up');
    expect(state).toBe(initialCelebrationState);
  });

  it('never mutates its input (pure reducer)', () => {
    const before: CelebrationState = { ...initialCelebrationState };
    const state = celebrateStep(initialCelebrationState, 'payload');
    expect(initialCelebrationState).toEqual(before);
    expect(state).not.toBe(initialCelebrationState);
  });
});

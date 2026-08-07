/**
 * S6-02 / FR-VIC-4 — the victory celebration queue as a pure state machine.
 * The screen feeds it events (payload landed, level-up moment, overlay hide)
 * and a tap-anywhere "skip". Assertions target stage progression, not
 * animation timing, so the queue is unit-testable without rendering.
 *
 *   idle ──payload──▶ celebrating ──level-up──▶ level-up ──hide──▶ final
 *     │                  │                      │                 │
 *     └── skip is a no-op┴────── skip ◀─────────┴──────── skip ────┘
 *   A later timed event after skip is always a no-op, so the tap cannot be
 *   overridden by an in-flight timer (e.g. a level-up chime still sounding).
 */

export type CelebrationEvent = 'payload' | 'level-up' | 'hide' | 'skip';

export type CelebrationStage = 'idle' | 'celebrating' | 'level-up' | 'final';

export interface CelebrationState {
  stage: CelebrationStage;
  /** Confetti run id; 0 = dismissed (FR-VIC-4 — skip clears the burst). */
  confettiRun: number;
  overlayVisible: boolean;
}

export const initialCelebrationState: CelebrationState = {
  stage: 'idle',
  confettiRun: 0,
  overlayVisible: false,
};

export function celebrateStep(state: CelebrationState, event: CelebrationEvent): CelebrationState {
  switch (event) {
    case 'payload':
      return state.stage === 'idle'
        ? { stage: 'celebrating', confettiRun: 1, overlayVisible: false }
        : state;
    case 'level-up':
      return state.stage === 'celebrating'
        ? { stage: 'level-up', confettiRun: 2, overlayVisible: true }
        : state;
    case 'hide':
      return state.stage === 'level-up'
        ? { ...state, stage: 'final', overlayVisible: false }
        : state;
    case 'skip':
      // Nothing has played yet (still syncing) — nothing to dismiss.
      if (state.stage === 'idle') {
        return state;
      }
      if (state.stage === 'final') {
        return state;
      }
      return { stage: 'final', confettiRun: 0, overlayVisible: false };
  }
}

/**
 * S6-02 / FR-VIC-4 / AT-02D — the victory celebration queue as a pure state
 * machine. The screen feeds it events (payload landed, level-up moment,
 * chapter moment, overlay hide) and a tap-anywhere "skip". Assertions target
 * stage progression, not animation timing, so the queue is unit-testable
 * without rendering.
 *
 *   idle ──payload──▶ celebrating ──level-up──▶ level-up ──chapter──▶ chapter ──hide──▶ final
 *     │                  │            │           │          │               │
 *     │                  └─chapter───▶┴───────────┴─chapter──▶┴───────────────┘
 *     └── skip is a no-op┴────── skip ◀───────────┴── skip ◀───┴────── skip ────┘
 *   A later timed event after skip is always a no-op, so the tap cannot be
 *   overridden by an in-flight timer (e.g. a level-up chime still sounding).
 */

export type CelebrationEvent = 'payload' | 'level-up' | 'chapter' | 'hide' | 'skip';

export type CelebrationStage = 'idle' | 'celebrating' | 'level-up' | 'chapter' | 'final';

export interface CelebrationState {
  stage: CelebrationStage;
  /** Confetti run id; 0 = dismissed (FR-VIC-4 — skip clears the burst). */
  confettiRun: number;
  /** Level-up overlay flash. */
  overlayVisible: boolean;
  /** Chapter overlay flash (AT-02D — final victory beat). */
  chapterOverlayVisible: boolean;
}

export const initialCelebrationState: CelebrationState = {
  stage: 'idle',
  confettiRun: 0,
  overlayVisible: false,
  chapterOverlayVisible: false,
};

export function celebrateStep(state: CelebrationState, event: CelebrationEvent): CelebrationState {
  switch (event) {
    case 'payload':
      return state.stage === 'idle'
        ? {
            stage: 'celebrating',
            confettiRun: 1,
            overlayVisible: false,
            chapterOverlayVisible: false,
          }
        : state;
    case 'level-up':
      return state.stage === 'celebrating'
        ? { stage: 'level-up', confettiRun: 2, overlayVisible: true, chapterOverlayVisible: false }
        : state;
    case 'chapter':
      // AT-02D — the final beat can follow the level-up flash or the initial
      // burst directly (no level-up this run).
      return state.stage === 'celebrating' || state.stage === 'level-up'
        ? { stage: 'chapter', confettiRun: 3, overlayVisible: false, chapterOverlayVisible: true }
        : state;
    case 'hide':
      if (state.stage === 'level-up') {
        return { ...state, stage: 'final', overlayVisible: false };
      }
      if (state.stage === 'chapter') {
        return { ...state, stage: 'final', chapterOverlayVisible: false };
      }
      return state;
    case 'skip':
      // Nothing has played yet (still syncing) — nothing to dismiss.
      if (state.stage === 'idle') {
        return state;
      }
      if (state.stage === 'final') {
        return state;
      }
      return {
        stage: 'final',
        confettiRun: 0,
        overlayVisible: false,
        chapterOverlayVisible: false,
      };
  }
}

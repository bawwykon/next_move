import { create } from 'zustand';

import {
  clearCheckpoint,
  readCheckpoint,
  writeCheckpoint,
  type WorkoutCheckpoint,
} from '@/data/checkpoint';

interface WorkoutState {
  /** The live checkpoint (Ref 03) — `null` when no quest is in progress. */
  checkpoint: WorkoutCheckpoint | null;
  /** Load the persisted checkpoint into memory (board banner, resume entry). */
  hydrate: () => Promise<WorkoutCheckpoint | null>;
  /** Persist + hold a fresh checkpoint (start / resume). */
  startWorkout: (questId: string, startedAtEpochMs: number, source?: 'custom') => Promise<void>;
  /** WK-01 — freeze the run at the pause instant (persisted for kills). */
  pauseWorkout: (pausedAtEpochMs: number) => Promise<void>;
  /** WK-01 — shift the start past the pause and clear the frozen instant. */
  resumeWorkout: (startedAtEpochMs: number) => Promise<void>;
  /** Delete the checkpoint file + drop it from memory (finish / quit / dismiss). */
  clearWorkout: () => Promise<void>;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  checkpoint: null,
  hydrate: async () => {
    const checkpoint = await readCheckpoint();
    set({ checkpoint });
    return checkpoint;
  },
  startWorkout: async (questId, startedAtEpochMs, source) => {
    const checkpoint: WorkoutCheckpoint = source
      ? { questId, startedAtEpochMs, source }
      : { questId, startedAtEpochMs };
    await writeCheckpoint(checkpoint);
    set({ checkpoint });
  },
  pauseWorkout: async (pausedAtEpochMs) => {
    const current = get().checkpoint;
    if (!current) {
      return;
    }
    const next: WorkoutCheckpoint = { ...current, pausedAtEpochMs };
    await writeCheckpoint(next);
    set({ checkpoint: next });
  },
  resumeWorkout: async (startedAtEpochMs) => {
    const current = get().checkpoint;
    if (!current) {
      return;
    }
    const next: WorkoutCheckpoint = { ...current, startedAtEpochMs };
    delete next.pausedAtEpochMs;
    await writeCheckpoint(next);
    set({ checkpoint: next });
  },
  clearWorkout: async () => {
    await clearCheckpoint();
    set({ checkpoint: null });
  },
}));

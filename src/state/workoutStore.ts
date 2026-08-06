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
  startWorkout: (questId: string, startedAtEpochMs: number) => Promise<void>;
  /** Delete the checkpoint file + drop it from memory (finish / quit / dismiss). */
  clearWorkout: () => Promise<void>;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  checkpoint: null,
  hydrate: async () => {
    const checkpoint = await readCheckpoint();
    set({ checkpoint });
    return checkpoint;
  },
  startWorkout: async (questId, startedAtEpochMs) => {
    const checkpoint: WorkoutCheckpoint = { questId, startedAtEpochMs };
    await writeCheckpoint(checkpoint);
    set({ checkpoint });
  },
  clearWorkout: async () => {
    await clearCheckpoint();
    set({ checkpoint: null });
  },
}));

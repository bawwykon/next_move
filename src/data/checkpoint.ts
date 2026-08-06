import AsyncStorage from '@react-native-async-storage/async-storage';

// Versioned key — bumping the suffix invalidates stale checkpoint shapes.
export const CHECKPOINT_KEY = 'workout.checkpoint.v1';

export interface WorkoutCheckpoint {
  questId: string;
  startedAtEpochMs: number;
}

function isCheckpoint(value: unknown): value is WorkoutCheckpoint {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.questId === 'string' &&
    typeof record.startedAtEpochMs === 'number' &&
    Number.isFinite(record.startedAtEpochMs)
  );
}

export async function writeCheckpoint(checkpoint: WorkoutCheckpoint): Promise<void> {
  await AsyncStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
}

/** Never throws — a missing, corrupted, or foreign shape reads as `null`. */
export async function readCheckpoint(): Promise<WorkoutCheckpoint | null> {
  try {
    const raw = await AsyncStorage.getItem(CHECKPOINT_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isCheckpoint(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearCheckpoint(): Promise<void> {
  await AsyncStorage.removeItem(CHECKPOINT_KEY);
}

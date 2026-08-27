/**
 * SET-01 — settings model. Pure defaults + merge. Persisted locally via
 * AsyncStorage and synced to profiles.settings JSONB for Sound/Haptics/Art.
 */
export interface AppSettings {
  soundFx: boolean;
  haptics: boolean;
  autoPauseOnCall: boolean;
  showExerciseArt: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  soundFx: true,
  haptics: true,
  autoPauseOnCall: true,
  showExerciseArt: true,
};

export const SETTINGS_STORAGE_KEY = 'next_move_settings';

export function mergeSettings(partial: Partial<AppSettings> | null | undefined): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
}

export type SettingsToggleKey = keyof AppSettings;

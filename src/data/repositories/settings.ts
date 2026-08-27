import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/data/supabase';
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  SETTINGS_STORAGE_KEY,
  type AppSettings,
} from '@/domain/settings/model';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

export async function loadLocalSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return mergeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveLocalSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage failures must never crash the UI
  }
}

export async function fetchRemoteSettings(
  profileId: string,
): Promise<RepoResult<Partial<AppSettings> | null>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', profileId)
    .maybeSingle();
  if (error) return fail(`Could not load settings: ${error.message}`);
  return ok((data?.settings as Partial<AppSettings> | null) ?? null);
}

export async function pushRemoteSettings(
  profileId: string,
  settings: Pick<AppSettings, 'soundFx' | 'haptics' | 'showExerciseArt'>,
): Promise<RepoResult<null>> {
  const current = await fetchRemoteSettings(profileId);
  const merged = { ...((current.data as Record<string, unknown>) ?? {}), ...settings };
  const { error } = await supabase
    .from('profiles')
    .update({ settings: merged } as never)
    .eq('id', profileId);
  if (error) return fail(`Could not save settings: ${error.message}`);
  return ok(null);
}

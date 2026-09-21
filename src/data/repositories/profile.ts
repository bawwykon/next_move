import { supabase } from '@/data/supabase';
import type { OnboardingAnswers } from '@/domain/recommendation/types';
import type { OnboardingPayload } from '@/features/onboarding/wizardController';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

export type OnboardingSaveError = 'signed_out' | 'save_failed';

export async function saveOnboarding(
  payload: OnboardingPayload,
): Promise<OnboardingSaveError | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return 'signed_out';
  }

  const { error: onboardingError } = await supabase.from('onboarding').upsert(
    {
      profile_id: user.id,
      activity_level: payload.activity_level,
      experience: payload.experience,
      goals: payload.goals,
      workout_time: payload.workout_time,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  );
  if (onboardingError) {
    return 'save_failed';
  }

  // PH3-01 — persist the display name if the user typed one.
  const profileUpdate: { onboarded: true; display_name?: string } = { onboarded: true };
  if (payload.display_name) {
    profileUpdate.display_name = payload.display_name;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id);
  if (profileError) {
    return 'save_failed';
  }

  return null;
}

/**
 * CUSTOM-AVATAR (M0059) — single-slot custom photo at
 * `avatars/{userId}/avatar.jpg` (upsert overwrite). Returns the public URL
 * on success; the caller cache-busts at render (`?t=`), so the stored URL
 * stays stable. Storage RLS scopes writes to the owner's folder; the
 * profiles UPDATE rides update-own (avatar_url is not a guarded column).
 */
const AVATAR_BUCKET = 'avatars';

export function avatarStoragePath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

export async function uploadCustomAvatar(
  userId: string,
  localUri: string,
  base64: string | null = null,
): Promise<RepoResult<string>> {
  // RN file access, in order of reliability:
  // 1. Picker-supplied base64 (expo-image-picker `base64: true`) — decoded
  //    with the global atob into a Uint8Array. No file:// fetch involved.
  // 2. fetch(file://).blob() fallback (BlobManager; arrayBuffer() is NOT
  //    reliably polyfilled in RN and must never be used here).
  let body: Uint8Array | Blob;
  if (base64) {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      body = bytes;
    } catch {
      return fail('Could not read the selected photo.');
    }
  } else {
    try {
      const response = await fetch(localUri);
      if (!response.ok) {
        return fail('Could not read the selected photo.');
      }
      try {
        body = await response.blob();
      } catch {
        return fail('Could not read the selected photo.');
      }
    } catch {
      return fail('Could not read the selected photo.');
    }
  }
  const path = avatarStoragePath(userId);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) {
    return fail(`Could not upload avatar: ${uploadError.message}`);
  }
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const { error: dbError } = await supabase
    .from('profiles')
    .update({ avatar_url: data.publicUrl })
    .eq('id', userId);
  if (dbError) {
    return fail(`Could not save avatar: ${dbError.message}`);
  }
  return ok(data.publicUrl);
}

/**
 * Reverts to the equipped RPG portrait: the DB null is the source of truth
 * for the UI, the storage remove is best-effort (a missing file still
 * resolves to the portrait).
 */
export async function deleteCustomAvatar(userId: string): Promise<RepoResult<null>> {
  const { error: dbError } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);
  if (dbError) {
    return fail(`Could not remove avatar: ${dbError.message}`);
  }
  await supabase.storage.from(AVATAR_BUCKET).remove([avatarStoragePath(userId)]);
  return ok(null);
}

export async function getOnboarded(): Promise<boolean | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarded')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data.onboarded;
}

/**
 * The saved plan answers (S2-02) — feeds recommendQuest's `onboarding`
 * argument. Null when the user skipped onboarding or has no row yet.
 */
export async function getOnboarding(profileId: string): Promise<OnboardingAnswers | null> {
  const { data, error } = await supabase
    .from('onboarding')
    .select('activity_level, experience, goals, workout_time')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    activity_level: data.activity_level,
    experience: data.experience,
    goals: data.goals,
    workout_time: data.workout_time ?? '',
  };
}

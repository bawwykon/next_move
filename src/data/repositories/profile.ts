import { supabase } from '@/data/supabase';
import type { OnboardingAnswers } from '@/domain/recommendation/types';
import type { OnboardingPayload } from '@/features/onboarding/wizardController';

export async function saveOnboarding(payload: OnboardingPayload): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return 'You need to be signed in to save your plan.';
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
    return onboardingError.message;
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
    return profileError.message;
  }

  return null;
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

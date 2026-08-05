import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

const supabaseUrl = process.env.HEALTH_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

async function main() {
  const email = 'demo@nextmove.app';
  const password = 'demo-pass-123';

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    throw new Error(`sign in failed: ${signInError.message}`);
  }

  const user = signIn.user;
  const accessToken = signIn.session?.access_token;

  if (!user) {
    throw new Error('sign in returned no user');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, onboarded, created_at')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error(`profile select failed: ${profileError.message}`);
  }

  const { data: onboarding, error: onboardingError } = await supabase
    .from('onboarding')
    .select('profile_id, activity_level, experience, goals, workout_time, completed_at')
    .eq('profile_id', user.id)
    .single();

  if (onboardingError) {
    throw new Error(`onboarding select failed: ${onboardingError.message}`);
  }

  console.log('ROUND TRIP OK');
  console.log(`session: authenticated user "${user.email}" (id ${user.id})`);
  console.log(`session: access token present: ${Boolean(accessToken)}`);
  console.log(`profile: display_name=${profile.display_name} onboarded=${profile.onboarded}`);
  console.log('onboarding row:', JSON.stringify(onboarding, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

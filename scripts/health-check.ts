import { supabase } from '../src/data/supabase';

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
    .select('id, age_range, activity_level, weekly_workouts, goal, target_steps, created_at')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error(`profile select failed: ${profileError.message}`);
  }

  console.log('ROUND TRIP OK');
  console.log(`session: authenticated user "${user.email}" (id ${user.id})`);
  console.log(`session: access token present: ${Boolean(accessToken)}`);
  console.log('profile row:', JSON.stringify(profile, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

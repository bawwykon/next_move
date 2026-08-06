-- S5-01: service_role is the trusted backend/tooling role (bypasses RLS but
-- still needs table privileges). The complete_quest RPC requires no direct grants
-- (it is SECURITY DEFINER), but live-DB integration tests and future server-side
-- jobs/screens need it to select/insert/update progression fixtures. Standard
-- Supabase convention: service_role holds full table access; it is never exposed
-- to a device token, so this does not widen the client trust boundary.
grant all on table public.profiles to service_role;
grant all on table public.quest_completions to service_role;
grant all on table public.mastery to service_role;
grant all on table public.streaks_rewards to service_role;
grant all on table public.profile_achievements to service_role;
grant all on table public.profile_cosmetics to service_role;
grant all on table public.onboarding to service_role;
grant all on table public.quests to service_role;
grant all on table public.quest_segments to service_role;
grant all on table public.exercise_library to service_role;
grant all on table public.achievements to service_role;
grant all on table public.cosmetics to service_role;
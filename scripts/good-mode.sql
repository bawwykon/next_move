-- QA-01 good-mode account: good@nextmove.app / good-pass-123
-- Creates auth user + profile if not exists, then unlocks everything

-- 1. Create auth user (like seed.sql) with fixed ID
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
  recovery_token, recovery_sent_at, email_change_token_new, email_change,
  email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
  phone_change, phone_change_token, phone_change_sent_at,
  email_change_token_current, email_change_confirm_status,
  reauthentication_token, reauthentication_sent_at, is_sso_user, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  'd7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f',
  'authenticated','authenticated',
  'good@nextmove.app',
  crypt('good-pass-123', gen_salt('bf')),
  now(), null, '', now(), '', now(), '', '', now(), null,
  '{"provider":"email","providers":["email"]}','{}', null, now(), now(),
  null, null, '', '', now(), '', 0, '', now(), false, false
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'd7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f',
  'd7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f',
  jsonb_build_object('sub','d7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f','email','good@nextmove.app'),
  'email', now(), now(), now()
) on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, display_name, onboarded)
values ('d7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f','Good', true)
on conflict (id) do update set display_name = excluded.display_name, onboarded = excluded.onboarded;

insert into public.onboarding (profile_id, activity_level, experience, goals, workout_time, completed_at)
values ('d7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f',2,2,array['build_a_habit','more_energy'],'any',now())
on conflict (profile_id) do update set activity_level=excluded.activity_level, experience=excluded.experience, goals=excluded.goals, workout_time=excluded.workout_time, completed_at=excluded.completed_at;

-- 2. Unlock all cosmetics (including 0035)
insert into public.profile_cosmetics (profile_id, cosmetic_id)
select 'd7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f', c.id from public.cosmetics c
on conflict do nothing;

-- 3. Unlock all achievements
insert into public.profile_achievements (profile_id, achievement_id, unlocked_at)
select 'd7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f', a.id, now() from public.achievements a
on conflict do nothing;

-- 4. Max progression
update public.profiles set
  level = 100, total_xp = 495000,
  current_chapter = 7, journey_quests = 365,
  current_streak = 100, longest_streak = 100
where id = 'd7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f';

-- 5. Max mastery
insert into public.mastery (profile_id, track, points) values
 ('d7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f','strength',2500),
 ('d7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f','endurance',2500),
 ('d7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f','mobility',2500),
 ('d7c8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f','discipline',2500)
on conflict (profile_id, track) do update set points = 2500;

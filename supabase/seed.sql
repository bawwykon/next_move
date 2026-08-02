insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e',
  'authenticated',
  'authenticated',
  'demo@nextmove.app',
  crypt('demo-pass-123', gen_salt('bf')),
  now(),
  null,
  '',
  now(),
  '',
  now(),
  '',
  '',
  now(),
  null,
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  null,
  now(),
  now(),
  null,
  null,
  '',
  '',
  now(),
  '',
  0,
  '',
  now(),
  false,
  false
)
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e',
  '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e',
  jsonb_build_object('sub', '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e', 'email', 'demo@nextmove.app'),
  'email',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do nothing;

insert into public.profiles (
  id,
  age_range,
  activity_level,
  weekly_workouts,
  goal,
  target_steps
)
values (
  '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e',
  '25_34',
  'moderate',
  4,
  'endurance',
  8000
)
on conflict (id) do nothing;

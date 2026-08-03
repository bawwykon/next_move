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

-- exercise catalog (15)
insert into public.exercise_library (slug, name, instruction, safety_note, categories, beginner_variation) values
  ('wall-push-up', 'Wall Push-Up', 'Stand an arm''s length from a wall with hands at shoulder height. Gently bend your elbows to bring your chest toward the wall, then push back to the start with control.', 'Keep your body in one straight line from head to heels and stop if you feel any strain in your shoulders.', '{"strength"}', 'Step closer to the wall for an easier angle.'),
  ('chair-squat', 'Chair Squat', 'Stand in front of a sturdy chair with feet hip-width apart. Lower yourself until your hips lightly touch the seat, then press through your heels to stand back up.', 'Keep your knees pointing over your toes and hold the chair with one hand for balance if you need it.', '{"strength"}', 'Use a higher chair or a cushion to shorten the movement.'),
  ('glute-bridge', 'Glute Bridge', 'Lie on your back with knees bent and feet flat on the floor. Press through your heels to lift your hips toward the ceiling, squeeze at the top, then lower with control.', 'Keep your shoulders and feet grounded and avoid arching your lower back.', '{"strength"}', 'Rest your hands on the floor at your sides for extra support.'),
  ('bird-dog', 'Bird Dog', 'Start on all fours with hands under your shoulders and knees under your hips. Reach one arm forward and the opposite leg back at the same time, hold briefly, then return and switch sides.', 'Keep your hips level and move slowly so you stay balanced.', '{"strength"}', 'Lift only the arm or only the leg until you feel steady.'),
  ('seated-leg-raise', 'Seated Leg Raise', 'Sit tall at the edge of a sturdy chair with hands at your sides. Lift one leg straight out in front, hold, then lower it slowly. Alternate legs.', 'Tighten your core and keep your back straight, using the chair seat for support.', '{"strength"}', 'Lift just a few inches or keep the knee slightly bent.'),
  ('wall-sit', 'Wall Sit', 'Slide your back down a wall until your knees are bent at a comfortable angle, with feet flat and hips below your knees. Hold the position and breathe steadily.', 'Stop if you feel any sharp pressure in your knees, and place your feet slightly wider than your hips for stability.', '{"strength"}', 'Hold a higher position or for a shorter time at first.'),
  ('march-in-place', 'March in Place', 'Stand tall and lift your knees one at a time as if marching. Swing your arms gently and keep a steady rhythm.', 'Land softly through the whole foot and keep your chest lifted.', '{"endurance"}', 'Touch each foot down without lifting the knee high.'),
  ('step-touch', 'Step Touch', 'Step one foot out to the side and bring the other foot to meet it, then step back the other way. Keep a light, steady rhythm.', 'Keep your steps small and controlled on smooth, level ground.', '{"endurance"}', 'Walk the pattern instead of stepping, or slow the pace.'),
  ('side-steps', 'Side Steps', 'Take a few steps to the right, then back to the left, staying low with soft knees. Move at a pace that keeps your breathing steady.', 'Keep a clear path around you and turn your whole body to change direction.', '{"endurance"}', 'Take smaller steps or walk side to side without bending as low.'),
  ('gentle-hops', 'Gentle Hops', 'Hop softly from one foot to the other with a light rhythm, landing quietly through the ball of the foot. Keep the hops low and controlled.', 'Skip the hops if your joints feel tender today and march instead.', '{"endurance"}', 'March in place with a little bounce instead of hopping.'),
  ('seated-march', 'Seated March', 'Sit tall with both feet flat. Lift one knee toward your chest, lower it, then lift the other, keeping a steady rhythm.', 'Hold the sides of the chair for balance and keep your back supported.', '{"endurance"}', 'Lift only the heel, or raise the knee a small amount.'),
  ('neck-shoulder-rolls', 'Neck and Shoulder Rolls', 'Slowly roll your shoulders forward and back in a circle, then gently turn your head side to side. Keep the movement small and smooth.', 'Move within a comfortable range and never force your neck.', '{"mobility"}', 'Only roll the shoulders if neck rotation feels like too much.'),
  ('cat-cow', 'Cat Cow', 'On all fours, round your back up toward the ceiling as you exhale, then gently lower and arch as you inhale. Move slowly with your breath.', 'Keep the motion comfortable and move only as far as feels good.', '{"mobility"}', 'Perform it seated with your hands on your knees.'),
  ('seated-hamstring-stretch', 'Seated Hamstring Stretch', 'Sit with one leg extended and the other foot resting near your inner thigh. Hinge gently forward from the hips and hold, then switch sides.', 'Keep a soft bend in the extended knee and stop before it pulls sharply.', '{"mobility"}', 'Rest your hands on your thigh or a towel for support.'),
  ('standing-quad-stretch', 'Standing Quad Stretch', 'Stand tall and hold a wall or chair for balance. Bend one knee and bring your heel toward your glute, hold gently, then switch legs.', 'Keep both knees close together and stop if your hip feels tight.', '{"mobility"}', 'Hold your ankle with a towel or band for a longer reach.')
on conflict (slug) do nothing;

-- quest definitions (10)
insert into public.quests (slug, title, description, difficulty, xp_reward, duration_sec, categories) values
  ('morning-stretch', 'Morning Stretch', 'Wake up your whole body with a gentle stretch routine that eases you into the day.', 'easy', 50, 480, '{"mobility"}'),
  ('first-steps', 'First Steps', 'A friendly introduction to daily movement with easy marching and walking steps.', 'easy', 50, 480, '{"endurance"}'),
  ('desk-break', 'Desk Break', 'Quick, desk-friendly moves to refresh your body between tasks.', 'easy', 50, 480, '{"mobility"}'),
  ('home-circuit', 'Home Circuit', 'A beginner-friendly bodyweight circuit you can complete in your living room.', 'easy', 50, 600, '{"strength"}'),
  ('steady-flow', 'Steady Flow', 'Slow, controlled movements and steady breathing to build focus and calm.', 'easy', 50, 480, '{"discipline"}'),
  ('power-walk', 'Power Walk', 'Brisk walking intervals that build your stamina step by step.', 'normal', 100, 720, '{"endurance"}'),
  ('core-basics', 'Core Basics', 'Foundation moves that strengthen your middle from the ground up.', 'normal', 100, 600, '{"strength"}'),
  ('full-body-flow', 'Full Body Flow', 'A flowing sequence that gently moves every major joint.', 'normal', 100, 720, '{"mobility"}'),
  ('interval-boost', 'Interval Boost', 'Structured work and rest intervals that lift your conditioning.', 'hard', 200, 900, '{"endurance"}'),
  ('strength-builder', 'Strength Builder', 'A structured circuit that builds whole-body strength safely.', 'hard', 200, 900, '{"strength"}')
on conflict (slug) do nothing;

-- quest segments (position 1-based, first warmup, last cooldown, sum = quest duration)
delete from public.quest_segments
where quest_id in (
  select id from public.quests where slug in (
    'morning-stretch', 'first-steps', 'desk-break', 'home-circuit', 'steady-flow',
    'power-walk', 'core-basics', 'full-body-flow', 'interval-boost', 'strength-builder'
  )
);

insert into public.quest_segments (quest_id, position, kind, exercise_id, duration_sec)
select q.id, s.position, s.kind, e.id, s.duration_sec
from public.quests q
join (
  values
    ('morning-stretch', 1, 'warmup', 'neck-shoulder-rolls', 60),
    ('morning-stretch', 2, 'work', 'cat-cow', 120),
    ('morning-stretch', 3, 'work', 'standing-quad-stretch', 90),
    ('morning-stretch', 4, 'work', 'seated-hamstring-stretch', 90),
    ('morning-stretch', 5, 'cooldown', 'march-in-place', 120),

    ('first-steps', 1, 'warmup', 'march-in-place', 60),
    ('first-steps', 2, 'work', 'step-touch', 120),
    ('first-steps', 3, 'work', 'side-steps', 120),
    ('first-steps', 4, 'rest', null, 60),
    ('first-steps', 5, 'work', 'seated-march', 60),
    ('first-steps', 6, 'cooldown', 'neck-shoulder-rolls', 60),

    ('desk-break', 1, 'warmup', 'neck-shoulder-rolls', 90),
    ('desk-break', 2, 'work', 'seated-hamstring-stretch', 120),
    ('desk-break', 3, 'work', 'standing-quad-stretch', 90),
    ('desk-break', 4, 'work', 'cat-cow', 90),
    ('desk-break', 5, 'cooldown', 'seated-march', 90),

    ('home-circuit', 1, 'warmup', 'march-in-place', 60),
    ('home-circuit', 2, 'work', 'wall-push-up', 90),
    ('home-circuit', 3, 'rest', null, 30),
    ('home-circuit', 4, 'work', 'chair-squat', 90),
    ('home-circuit', 5, 'rest', null, 30),
    ('home-circuit', 6, 'work', 'glute-bridge', 90),
    ('home-circuit', 7, 'rest', null, 30),
    ('home-circuit', 8, 'work', 'bird-dog', 90),
    ('home-circuit', 9, 'cooldown', 'neck-shoulder-rolls', 90),

    ('steady-flow', 1, 'warmup', 'neck-shoulder-rolls', 60),
    ('steady-flow', 2, 'work', 'cat-cow', 120),
    ('steady-flow', 3, 'work', 'standing-quad-stretch', 90),
    ('steady-flow', 4, 'work', 'seated-hamstring-stretch', 90),
    ('steady-flow', 5, 'work', 'wall-sit', 60),
    ('steady-flow', 6, 'cooldown', 'march-in-place', 60),

    ('power-walk', 1, 'warmup', 'march-in-place', 90),
    ('power-walk', 2, 'work', 'side-steps', 120),
    ('power-walk', 3, 'rest', null, 30),
    ('power-walk', 4, 'work', 'step-touch', 120),
    ('power-walk', 5, 'rest', null, 30),
    ('power-walk', 6, 'work', 'gentle-hops', 90),
    ('power-walk', 7, 'rest', null, 30),
    ('power-walk', 8, 'work', 'march-in-place', 120),
    ('power-walk', 9, 'cooldown', 'seated-march', 90),

    ('core-basics', 1, 'warmup', 'cat-cow', 60),
    ('core-basics', 2, 'work', 'bird-dog', 90),
    ('core-basics', 3, 'rest', null, 30),
    ('core-basics', 4, 'work', 'seated-leg-raise', 90),
    ('core-basics', 5, 'rest', null, 30),
    ('core-basics', 6, 'work', 'glute-bridge', 90),
    ('core-basics', 7, 'rest', null, 30),
    ('core-basics', 8, 'work', 'wall-sit', 90),
    ('core-basics', 9, 'cooldown', 'seated-hamstring-stretch', 90),

    ('full-body-flow', 1, 'warmup', 'neck-shoulder-rolls', 90),
    ('full-body-flow', 2, 'work', 'cat-cow', 120),
    ('full-body-flow', 3, 'rest', null, 60),
    ('full-body-flow', 4, 'work', 'standing-quad-stretch', 120),
    ('full-body-flow', 5, 'work', 'seated-hamstring-stretch', 120),
    ('full-body-flow', 6, 'work', 'glute-bridge', 90),
    ('full-body-flow', 7, 'cooldown', 'seated-march', 120),

    ('interval-boost', 1, 'warmup', 'march-in-place', 90),
    ('interval-boost', 2, 'work', 'step-touch', 150),
    ('interval-boost', 3, 'rest', null, 30),
    ('interval-boost', 4, 'work', 'side-steps', 150),
    ('interval-boost', 5, 'rest', null, 30),
    ('interval-boost', 6, 'work', 'gentle-hops', 150),
    ('interval-boost', 7, 'rest', null, 30),
    ('interval-boost', 8, 'work', 'march-in-place', 150),
    ('interval-boost', 9, 'cooldown', 'seated-march', 120),

    ('strength-builder', 1, 'warmup', 'march-in-place', 90),
    ('strength-builder', 2, 'work', 'wall-push-up', 150),
    ('strength-builder', 3, 'rest', null, 30),
    ('strength-builder', 4, 'work', 'chair-squat', 150),
    ('strength-builder', 5, 'rest', null, 30),
    ('strength-builder', 6, 'work', 'glute-bridge', 150),
    ('strength-builder', 7, 'rest', null, 30),
    ('strength-builder', 8, 'work', 'wall-sit', 120),
    ('strength-builder', 9, 'cooldown', 'seated-hamstring-stretch', 150)
) as s(slug, position, kind, exercise_slug, duration_sec)
on s.slug = q.slug
left join public.exercise_library e on e.slug = s.exercise_slug;

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
  display_name,
  onboarded
)
values (
  '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e',
  'Adventurer',
  true
)
on conflict (id) do update set
  display_name = excluded.display_name,
  onboarded = excluded.onboarded;

insert into public.onboarding (
  profile_id,
  activity_level,
  experience,
  goals,
  workout_time,
  completed_at
)
values (
  '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e',
  2,
  2,
  array['build_a_habit', 'more_energy'],
  'any',
  now()
)
on conflict (profile_id) do update set
  activity_level = excluded.activity_level,
  experience = excluded.experience,
  goals = excluded.goals,
  workout_time = excluded.workout_time,
  completed_at = excluded.completed_at;

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

-- achievements (13) — unlock logic lives in the complete_quest RPC (Ref 08);
-- the trigger column below is for traceability only, the schema carries no condition column:
--   first-quest        -> complete any quest
--   first-level        -> reach level 2
--   first-week         -> quests on 7 different days
--   workouts-50        -> 50 completions
--   workouts-100       -> 100 completions
--   workouts-250       -> 250 completions
--   streak-7           -> 7-day streak
--   streak-30          -> 30-day streak
--   streak-100         -> 100-day streak
--   phoenix            -> return after a 7+ day break
--   early-bird         -> 100 quests started before 10:00 local
--   night-owl          -> 100 quests started after 20:00 local
--   master-adventurer  -> reach level 100
insert into public.achievements (slug, title, description, hint, category) values
  ('first-quest', 'First Quest', 'Complete your first quest.', 'Take the first step.', 'beginner'),
  ('first-level', 'First Level', 'Reach level 2.', 'Every journey has its first summit.', 'beginner'),
  ('first-week', 'First Week', 'Complete quests on seven different days.', 'A week of small wins adds up.', 'beginner'),
  ('workouts-50', '50 Workouts', 'Complete 50 quests.', 'A number worth chasing.', 'progress'),
  ('workouts-100', '100 Workouts', 'Complete 100 quests.', 'Three digits to your name.', 'progress'),
  ('workouts-250', '250 Workouts', 'Complete 250 quests.', 'Your rhythm is your own.', 'progress'),
  ('streak-7', '7 Day Streak', 'Keep a 7-day quest streak.', 'Seven small days, one strong chain.', 'consistency'),
  ('streak-30', '30 Day Streak', 'Keep a 30-day quest streak.', 'A full month of showing up.', 'consistency'),
  ('streak-100', '100 Day Streak', 'Keep a 100-day quest streak.', 'A hundred days of quiet consistency.', 'consistency'),
  ('phoenix', 'Phoenix', 'Return after a break of a week or more.', 'Even pauses lead somewhere good.', 'special'),
  ('early-bird', 'Early Bird', 'Start 100 quests before 10:00 AM.', 'The day starts early for some.', 'special'),
  ('night-owl', 'Night Owl', 'Start 100 quests after 8:00 PM.', 'Night holds its own magic.', 'special'),
  ('master-adventurer', 'Master Adventurer', 'Reach level 100.', 'The summit waits for the patient.', 'special')
on conflict (slug) do nothing;

-- cosmetics (18)
insert into public.cosmetics (slug, type, name, unlock_rule) values
  ('frame-default', 'frame', 'Classic Frame', '{}'),
  ('frame-level-05', 'frame', 'Level 5 Frame', '{"kind":"level","level":5}'),
  ('frame-level-10', 'frame', 'Level 10 Frame', '{"kind":"level","level":10}'),
  ('frame-level-25', 'frame', 'Level 25 Frame', '{"kind":"level","level":25}'),
  ('frame-level-50', 'frame', 'Level 50 Frame', '{"kind":"level","level":50}'),
  ('frame-level-100', 'frame', 'Level 100 Frame', '{"kind":"level","level":100}'),
  ('title-adventurer', 'title', 'Adventurer', '{"kind":"achievement","slug":"first-quest"}'),
  ('title-level-05', 'title', 'Explorer', '{"kind":"level","level":5}'),
  ('title-level-10', 'title', 'Trailblazer', '{"kind":"level","level":10}'),
  ('title-level-25', 'title', 'Voyager', '{"kind":"level","level":25}'),
  ('title-level-50', 'title', 'Champion', '{"kind":"level","level":50}'),
  ('title-level-100', 'title', 'Legend', '{"kind":"level","level":100}'),
  ('bg-chapter-02', 'background', 'Chapter 2 Scene', '{"kind":"chapter","chapter":2}'),
  ('bg-chapter-04', 'background', 'Chapter 4 Scene', '{"kind":"chapter","chapter":4}'),
  ('bg-chapter-06', 'background', 'Chapter 6 Scene', '{"kind":"chapter","chapter":6}'),
  ('portrait-default', 'portrait', 'Classic Portrait', '{}'),
  ('portrait-phoenix', 'portrait', 'Phoenix Portrait', '{"kind":"achievement","slug":"phoenix"}'),
  ('portrait-master', 'portrait', 'Master Portrait', '{"kind":"achievement","slug":"master-adventurer"}')
on conflict (slug) do nothing;

-- demo user progression (S3/S5 board-proof fixtures). Seeded with relative dates
-- so board-proof's "completed today and yesterday" and "streak 2/2" assertions
-- hold no matter when the local stack is reset. Keys are fixed so replays of
-- db reset are idempotent.
insert into public.quest_completions (
  profile_id, quest_id, idempotency_key, started_at, completed_at, duration_sec, xp_awarded, day_key, mastered, bonus_breakdown
)
select
  '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e',
  q.id,
  s.idem::uuid,
  s.started,
  s.completed,
  q.duration_sec,
  50,
  to_char(s.started, 'YYYY-MM-DD'),
  '{}',
  jsonb_build_object('xp', jsonb_build_object('total', 50))
from public.quests q
join (
  values
    ('morning-stretch', 'a0000000-0000-4000-8000-0000000000aa', now() - interval '10 days', now() - interval '10 days' + interval '8 minutes'),
    ('morning-stretch', 'a0000000-0000-4000-8000-0000000000bb', now() - interval '1 day',     now() - interval '1 day'     + interval '8 minutes'),
    ('morning-stretch', 'a0000000-0000-4000-8000-0000000000cc', now(),                        now()                        + interval '8 minutes')
) as s(slug, idem, started, completed) on s.slug = q.slug
on conflict (profile_id, idempotency_key) do nothing;

-- four mastery tracks visible on the board
insert into public.mastery (profile_id, track, points)
select '3f8a2c1e-6f5b-4a7d-9c2e-1b4d6f8a0c3e', t, 0
from unnest(array['discipline', 'endurance', 'mobility', 'strength']) as t
on conflict (profile_id, track) do nothing;

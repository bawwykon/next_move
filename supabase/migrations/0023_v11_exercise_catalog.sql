-- AT-02B / v1.1: exercise catalog 15 → 20 (owner-approved set).
-- 7 new exercises, short copy per owner direction (illustrations carry the
-- visual guide). Quest segments are remapped BEFORE the obsolete rows are
-- removed; the two removed exercises are gone from the live catalog.

-- 7 new exercises.
insert into public.exercise_library (slug, name, instruction, safety_note, categories, beginner_variation) values
  ('squat', 'Squat', 'Lower your hips back and down until your thighs are roughly parallel, then press through your heels to stand.', 'Keep knees tracking over toes and your chest lifted.', '{"strength"}', 'Sit onto a chair or low box.'),
  ('push-up', 'Push-Up', 'From a straight-arm plank, lower your chest to just above the floor, then push back up.', 'Keep your body in one line; don''t let hips sag.', '{"strength"}', 'Knees-down or wall push-up.'),
  ('lunges', 'Lunges', 'Step one leg forward and lower both knees to about 90 degrees, then push back to standing.', 'Keep your front knee over your ankle.', '{"strength","mobility"}', 'Hold a wall or chair; take a smaller step.'),
  ('plank', 'Plank', 'Hold a straight-arm or forearm plank with your body in one line.', 'Breathe steadily; stop if your lower back aches.', '{"strength","discipline"}', 'Knees-down or wall plank.'),
  ('bicycle-crunch', 'Bicycle Crunch', 'Lie on your back, lift your shoulders, and alternate bringing opposite elbow to knee in a pedaling motion.', 'Move slowly and keep your lower back pressed down.', '{"strength","discipline"}', 'March the legs instead of pedaling.'),
  ('mountain-climber', 'Mountain Climbers', 'From a straight-arm plank, drive your knees toward your chest one at a time, keeping your hips low.', 'Keep shoulders over wrists; small, steady steps.', '{"endurance","strength"}', 'Slow step-throughs instead of hops.'),
  ('burpees', 'Burpees', 'From standing, squat down, step or jump back to a plank, return to the squat, then jump up.', 'Land softly with bent knees on the jump.', '{"endurance","strength"}', 'Step back instead of jumping; walk hands in and out.')
on conflict (slug) do nothing;

-- Remap quest segments before removal: side-steps → step-touch (6 rows:
-- first-steps ×2, power-walk, interval-boost, interval-peak ×3), chair-squat
-- → squat (3 rows: home-circuit ×2, strength-builder).
update public.quest_segments
set exercise_id = (select id from public.exercise_library where slug = 'step-touch')
where exercise_id = (select id from public.exercise_library where slug = 'side-steps');

update public.quest_segments
set exercise_id = (select id from public.exercise_library where slug = 'squat')
where exercise_id = (select id from public.exercise_library where slug = 'chair-squat');

-- The two removed exercises (v1.0 set, owner decision).
delete from public.exercise_library where slug in ('side-steps', 'chair-squat');
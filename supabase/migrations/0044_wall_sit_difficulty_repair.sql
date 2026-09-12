-- 0044_wall_sit_difficulty_repair.sql
-- Forward repair (never amend applied migrations): 0028_wall_sit_intermediate
-- assumes exercise_library rows already exist, but on a fresh `db reset` the
-- seed inserts them AFTER all migrations run (with the column default), so
-- 0028 updated zero rows and wall-sit stayed beginner. That silently broke
-- the 5+-intermediate => Hard classification (BYQ/custom difficulty rule).
-- This upsert is order-independent: it fixes live databases and survives
-- future resets regardless of seed timing. Values verbatim from seed.sql.
insert into public.exercise_library
  (slug, name, instruction, safety_note, categories, beginner_variation, difficulty)
values
  ('wall-sit',
   'Wall Sit',
   'Slide your back down a wall until your knees are bent at a comfortable angle, with feet flat and hips below your knees. Hold the position and breathe steadily.',
   'Stop if you feel any sharp pressure in your knees, and place your feet slightly wider than your hips for stability.',
   '{"strength"}',
   'Hold a higher position or for a shorter time at first.',
   'intermediate')
on conflict (slug) do update set difficulty = 'intermediate';

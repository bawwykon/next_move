-- 0051_normal_quests_no_advanced.sql
-- Owner review: advanced-tier exercises don't belong in Normal quests — no
-- Normal quest has ever carried one (core-basics, full-body-flow and
-- power-walk are beginner/intermediate throughout; advanced lives in hard
-- quests only). The 0050 rebalance broke this twice; two same-duration
-- swaps restore it (durations, sums, tiers, categories all untouched):
-- - total-balance pos 10: bicycle-crunch 45 -> gentle-hops 45 (dynamic
--   footwork fits the balance theme; trio support casts stay distinct).
-- - lateral-power pos 6: mountain-climber 45 -> step-touch 45 (lateral
--   stepping fits the theme; intermediate tier preserved).
-- Forward repair (applied migrations are immutable); seed.sql mirrors.
update public.quest_segments
   set exercise_id = (select id from public.exercise_library where slug = 'gentle-hops')
 where quest_id = (select id from public.quests where slug = 'total-balance')
   and position = 10
   and exercise_id = (select id from public.exercise_library where slug = 'bicycle-crunch');

update public.quest_segments
   set exercise_id = (select id from public.exercise_library where slug = 'step-touch')
 where quest_id = (select id from public.quests where slug = 'lateral-power')
   and position = 6
   and exercise_id = (select id from public.exercise_library where slug = 'mountain-climber');

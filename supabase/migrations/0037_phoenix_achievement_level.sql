-- 0037_phoenix_achievement_level.sql
-- Shift Phoenix achievement from gap-days (7-day quit-farm) to Level 25 milestone.
-- Aligns with portrait-phoenix cosmetic (0036) and removes the perverse incentive
-- to stop exercising for a week. NOTE: column is `hint`, not `flavor`
-- (achievements table has no flavor column; see 0005 + seed column list).

update public.achievements
set
  unlock_rule = '{"kind":"level","level":25}',
  description = 'Reach Level 25 in your fitness journey.',
  hint = 'From the ashes of repetition, a disciplined habit rises.'
where slug = 'phoenix';

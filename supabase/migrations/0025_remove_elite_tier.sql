-- AT-02I - remove the elite difficulty tier. Three tiers remain (easy/normal/
-- hard at 50/100/200 XP); Interval Peak demotes from elite @400 to hard @200.
-- The client type, recommender ladder, board badge and elite art are removed
-- in lock-step; fresh installs get the same shape via seed.sql.
-- Order matters: demote the offending row BEFORE adding the tighter checks.

alter table public.quests drop constraint quests_difficulty_check;
alter table public.quests drop constraint quests_xp_reward_check;

update public.quests
   set difficulty = 'hard',
       xp_reward = 200,
       description = 'Three rounds of intervals, each a little harder than the last - the toughest endurance climb.'
 where slug = 'interval-peak';

alter table public.quests
  add constraint quests_difficulty_check
  check (difficulty in ('easy', 'normal', 'hard'));
alter table public.quests
  add constraint quests_xp_reward_check
  check (xp_reward in (50, 100, 200));

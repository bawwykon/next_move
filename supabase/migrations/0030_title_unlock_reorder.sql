-- PH3-02: swap title unlock thresholds so progression feels right.
-- Champion (the aspirational mid-game title) unlocks earlier at level 25,
-- Legend moves to 50, and Voyager (the late-game prestige) goes to 100.

update public.cosmetics
   set unlock_rule = '{"kind":"level","level":100}'::jsonb
 where slug = 'title-level-25';

update public.cosmetics
   set unlock_rule = '{"kind":"level","level":25}'::jsonb
 where slug = 'title-level-50';

update public.cosmetics
   set unlock_rule = '{"kind":"level","level":50}'::jsonb
 where slug = 'title-level-100';

-- S5-02: achievements gain a machine-readable unlock rule (ED-21).
-- Previously the 13 unlock semantics lived only in seed.sql comments and the
-- RPC stubbed `achievements`/`cosmetics` to []. The complete_quest RPC (0020)
-- now evaluates these rules against the post-math state and returns only
-- newly-unlocked items. Rule kinds (generic evaluator, no per-achievement CASE):
--   {'kind':'quests','count':n}            journey_quests >= n
--   {'kind':'level','level':n}             level >= n
--   {'kind':'streak','days':n}             current_streak >= n
--   {'kind':'distinct-days','count':n}     n different day_keys completed
--   {'kind':'gap-days','days':n}           returned after a break of n+1+ days
--                                           (phoenix days: 7 -> return gap >= 8)
--   {'kind':'hour-before','hour':H,'count':n}   n completions started before H:00 UTC
--   {'kind':'hour-after','hour':H,'count':n}    n completions started at/after H:00 UTC
-- '{}' (or kind-less) rules are inert. Cosmetics rules (already in 0006):
--   {'kind':'level','level':n}             level >= n
--   {'kind':'chapter','chapter':n}         current_chapter >= n
--   {'kind':'achievement','slug':slug}     player owns that achievement
alter table public.achievements
  add column if not exists unlock_rule jsonb not null default '{}'::jsonb;
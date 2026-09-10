-- 0040_quest_duration_floor_420.sql
-- The rebalanced catalog (DEV-CARD_WORKOUT_REBALANCE_SPEC) authors
-- core-basics at 450s of segments; the 0002-era 480s floor predates the
-- rebalance and rejects the approved content. Widen the guardrail to
-- 420–1200s (durations still equal their segment sums; the RPC's ±15%
-- plausibility gate is unchanged).
alter table public.quests drop constraint if exists quests_duration_sec_check;
alter table public.quests
  add constraint quests_duration_sec_check check (duration_sec between 420 and 1200);

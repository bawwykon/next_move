-- 0045_gentle_hops_intermediate.sql
-- Owner call: gentle-hops is a Normal/intermediate workout (matches the
-- client map in src/domain/exercises/difficulty.ts, which already carries
-- it as intermediate). Plain UPDATE: the row is guaranteed in live
-- databases, and seed.sql now carries 'intermediate' so fresh resets are
-- correct by construction regardless of ordering.
update public.exercise_library
   set difficulty = 'intermediate'
 where slug = 'gentle-hops' and difficulty <> 'intermediate';

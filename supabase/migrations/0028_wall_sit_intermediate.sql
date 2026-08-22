-- TUNE-01 - reclassify wall-sit from beginner to intermediate. The isometric
-- hold is a real burn; the client map (src/domain/exercises/difficulty.ts)
-- mirrors this row, so builder projections and detail icons stay in lockstep
-- with the completion RPC's weights.

update public.exercise_library
   set difficulty = 'intermediate'
 where slug = 'wall-sit';

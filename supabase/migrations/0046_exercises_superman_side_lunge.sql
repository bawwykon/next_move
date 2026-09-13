-- 0046_exercises_superman_side_lunge.sql
-- Big-3 batch: 2 new catalog exercises (art in assets/exercises/ + thumbs,
-- client map in src/domain/exercises/difficulty.ts, i18n catalog copy).
-- Plain INSERTs with on-conflict ignore: safe on live databases and fresh
-- resets alike (seed.sql carries the same rows for db-reset correctness).
-- Difficulty is server-authoritative for builder XP weights (ED-34):
-- superman is beginner (1pt/block), side-lunge intermediate (2pts/block).
insert into public.exercise_library (slug, name, instruction, safety_note, categories, beginner_variation, difficulty) values
  ('superman', 'Superman', 'Lie face down, simultaneously lift chest, arms, and legs off floor, squeeze lower back, then lower with control.', 'Keep neck neutral looking down; do not strain or arch forcefully.', '{"strength","mobility"}', 'Lift arms only or legs only.', 'beginner'),
  ('side-lunge', 'Side Lunge', 'Step wide to one side, bend knee and sink hips back while keeping trailing leg straight. Push through heel to return.', 'Keep front heel grounded and chest open.', '{"strength","mobility"}', 'Take a shallower step or hold a chair for support.', 'intermediate')
on conflict (slug) do nothing;

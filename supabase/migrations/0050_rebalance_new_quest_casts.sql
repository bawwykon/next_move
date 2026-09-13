-- 0050_rebalance_new_quest_casts.sql
-- Owner review: superman + side-lunge repeated too much across the 3 new
-- quests (5 blocks each), and the trio shared its whole support cast
-- (glute-bridge, bird-dog) with each other. Rebalance, same durations:
-- - hero-stretch (480s): superman x2 (was x3); support goes to underused
--   wall-push-up + seated-leg-raise (previously zero work blocks anywhere);
--   warmup switches to march-in-place so all three don't open on cat-cow.
-- - lateral-power (570s): side-lunge x2 (was x3); the cut 60s block becomes
--   mountain-climber 45 (+15 to the glute-bridge closer, 30->45 to hold 570).
-- - total-balance (600s): superman x1 + side-lunge x1 (were x2 each); new
--   support wall-sit + bicycle-crunch (balance/stability core, both
--   underused); cooldown switches to neck-shoulder-rolls.
-- Result: superman 3, side-lunge 3, and no two of the trio share more than
-- one support exercise. Sums, tiers, categories untouched (segment sums
-- still equal the declared durations exactly).
-- Forward repair only (applied migrations are immutable): delete+insert
-- scoped to the 3 slugs; seed.sql mirrors these rows.
delete from public.quest_segments
where quest_id in (
  select id from public.quests where slug in ('hero-stretch', 'lateral-power', 'total-balance')
);

insert into public.quest_segments (quest_id, position, kind, exercise_id, duration_sec)
select q.id, s.position, s.kind, e.id, s.duration_sec
from public.quests q
join (
  values
    ('hero-stretch', 1, 'warmup', 'march-in-place', 60),
    ('hero-stretch', 2, 'work', 'superman', 30),
    ('hero-stretch', 3, 'rest', null, 30),
    ('hero-stretch', 4, 'work', 'glute-bridge', 45),
    ('hero-stretch', 5, 'rest', null, 30),
    ('hero-stretch', 6, 'work', 'wall-push-up', 45),
    ('hero-stretch', 7, 'rest', null, 30),
    ('hero-stretch', 8, 'work', 'superman', 45),
    ('hero-stretch', 9, 'rest', null, 30),
    ('hero-stretch', 10, 'work', 'seated-leg-raise', 45),
    ('hero-stretch', 11, 'rest', null, 30),
    ('hero-stretch', 12, 'cooldown', 'seated-hamstring-stretch', 60),

    ('lateral-power', 1, 'warmup', 'march-in-place', 60),
    ('lateral-power', 2, 'work', 'side-lunge', 45),
    ('lateral-power', 3, 'rest', null, 30),
    ('lateral-power', 4, 'work', 'squat', 60),
    ('lateral-power', 5, 'rest', null, 30),
    ('lateral-power', 6, 'work', 'mountain-climber', 45),
    ('lateral-power', 7, 'rest', null, 30),
    ('lateral-power', 8, 'work', 'lunges', 60),
    ('lateral-power', 9, 'rest', null, 30),
    ('lateral-power', 10, 'work', 'side-lunge', 45),
    ('lateral-power', 11, 'rest', null, 30),
    ('lateral-power', 12, 'work', 'glute-bridge', 45),
    ('lateral-power', 13, 'cooldown', 'standing-quad-stretch', 60),

    ('total-balance', 1, 'warmup', 'cat-cow', 60),
    ('total-balance', 2, 'work', 'superman', 45),
    ('total-balance', 3, 'rest', null, 30),
    ('total-balance', 4, 'work', 'side-lunge', 60),
    ('total-balance', 5, 'rest', null, 30),
    ('total-balance', 6, 'work', 'bird-dog', 60),
    ('total-balance', 7, 'rest', null, 30),
    ('total-balance', 8, 'work', 'wall-sit', 45),
    ('total-balance', 9, 'rest', null, 30),
    ('total-balance', 10, 'work', 'bicycle-crunch', 45),
    ('total-balance', 11, 'rest', null, 30),
    ('total-balance', 12, 'work', 'plank', 45),
    ('total-balance', 13, 'rest', null, 30),
    ('total-balance', 14, 'cooldown', 'neck-shoulder-rolls', 60)
) as s(slug, position, kind, exercise_slug, duration_sec)
on s.slug = q.slug
left join public.exercise_library e on e.slug = s.exercise_slug;

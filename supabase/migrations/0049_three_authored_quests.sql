-- 0049_three_authored_quests.sql
-- 3 authored quests showcasing superman + side-lunge (both in the catalog
-- since 0046). Segment sums equal the declared durations exactly (the RPC
-- ±15% timer gate reads duration_sec), warmup first / cooldown last, rests
-- between work blocks, beginner-safe pacing per the S11-01 conventions.
-- Idempotent delete+insert scoped to the 3 new slugs; seed.sql carries the
-- same rows so fresh resets agree with live databases.
insert into public.quests (slug, title, description, difficulty, xp_reward, duration_sec, categories) values
  ('hero-stretch', 'Hero''s Rise', 'Rise like a hero: back-strengthening holds meet gentle stretches.', 'easy', 100, 480, '{"mobility"}'),
  ('lateral-power', 'Lateral Flow', 'Side-to-side leg power — lunges, squats, and steady rests.', 'normal', 200, 570, '{"strength"}'),
  ('total-balance', 'Total Body Balance', 'Superman holds and side lunges for head-to-toe steadiness.', 'normal', 200, 600, '{"strength"}')
on conflict (slug) do nothing;

delete from public.quest_segments
where quest_id in (
  select id from public.quests where slug in ('hero-stretch', 'lateral-power', 'total-balance')
);

insert into public.quest_segments (quest_id, position, kind, exercise_id, duration_sec)
select q.id, s.position, s.kind, e.id, s.duration_sec
from public.quests q
join (
  values
    -- hero-stretch: easy, 480s. Superman in short progressive holds (30/45/45).
    ('hero-stretch', 1, 'warmup', 'cat-cow', 60),
    ('hero-stretch', 2, 'work', 'superman', 30),
    ('hero-stretch', 3, 'rest', null, 30),
    ('hero-stretch', 4, 'work', 'glute-bridge', 45),
    ('hero-stretch', 5, 'rest', null, 30),
    ('hero-stretch', 6, 'work', 'superman', 45),
    ('hero-stretch', 7, 'rest', null, 30),
    ('hero-stretch', 8, 'work', 'bird-dog', 45),
    ('hero-stretch', 9, 'rest', null, 30),
    ('hero-stretch', 10, 'work', 'superman', 45),
    ('hero-stretch', 11, 'rest', null, 30),
    ('hero-stretch', 12, 'cooldown', 'seated-hamstring-stretch', 60),

    -- lateral-power: normal, 570s. Side-lunge density (45/60/45) with loaded support.
    ('lateral-power', 1, 'warmup', 'march-in-place', 60),
    ('lateral-power', 2, 'work', 'side-lunge', 45),
    ('lateral-power', 3, 'rest', null, 30),
    ('lateral-power', 4, 'work', 'squat', 60),
    ('lateral-power', 5, 'rest', null, 30),
    ('lateral-power', 6, 'work', 'side-lunge', 60),
    ('lateral-power', 7, 'rest', null, 30),
    ('lateral-power', 8, 'work', 'lunges', 60),
    ('lateral-power', 9, 'rest', null, 30),
    ('lateral-power', 10, 'work', 'side-lunge', 45),
    ('lateral-power', 11, 'rest', null, 30),
    ('lateral-power', 12, 'work', 'glute-bridge', 30),
    ('lateral-power', 13, 'cooldown', 'standing-quad-stretch', 60),

    -- total-balance: normal, 600s. Superman + side-lunge alternating with
    -- stabilizer support (bird-dog, plank) and full rests throughout.
    ('total-balance', 1, 'warmup', 'cat-cow', 60),
    ('total-balance', 2, 'work', 'superman', 45),
    ('total-balance', 3, 'rest', null, 30),
    ('total-balance', 4, 'work', 'side-lunge', 45),
    ('total-balance', 5, 'rest', null, 30),
    ('total-balance', 6, 'work', 'bird-dog', 60),
    ('total-balance', 7, 'rest', null, 30),
    ('total-balance', 8, 'work', 'superman', 60),
    ('total-balance', 9, 'rest', null, 30),
    ('total-balance', 10, 'work', 'side-lunge', 60),
    ('total-balance', 11, 'rest', null, 30),
    ('total-balance', 12, 'work', 'plank', 30),
    ('total-balance', 13, 'rest', null, 30),
    ('total-balance', 14, 'cooldown', 'seated-hamstring-stretch', 60)
) as s(slug, position, kind, exercise_slug, duration_sec)
on s.slug = q.slug
left join public.exercise_library e on e.slug = s.exercise_slug;

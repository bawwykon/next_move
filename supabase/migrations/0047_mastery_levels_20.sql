-- 0047_mastery_levels_20.sql
-- Big-3 MASTERY-LEVELS: raw mastery points become a 1..20 rank ladder.
-- 1. mastery_level_for_points rewritten: L1 0, L2 100, L3 250, L4 375,
--    L5 500, L6 1000, L7 1250, L8 1500, L9 1750, L10 2000 (Master Badge),
--    then +500/level to a 7000-point L20 cap. Ranks: 1 Novice, 2-4
--    Apprentice, 5-9 Adept, 10-20 Master (client titles mirror this).
--    Accrual is untouched (+30/touched track, +15 discipline): only the
--    level boundaries move, so existing points re-level upward (L2 lands
--    earlier; nothing already earned is taken away).
-- 2. New achievement rule kind 'mastery': {"kind":"mastery","track":...,
--    "level":N} scores post-accrual track points through the new curve.
-- 3. Four Level-10 Master Badge achievements (mastery-{track}-10).
-- Re-emits apply_completion_progression from 0043 verbatim except the new
-- CASE branch; both complete_quest and complete_custom_workout delegate here.

create or replace function public.mastery_level_for_points(points bigint)
returns int
language sql
immutable
as $fn$
  select case
    when points >= 7000 then 20
    when points >= 6500 then 19
    when points >= 6000 then 18
    when points >= 5500 then 17
    when points >= 5000 then 16
    when points >= 4500 then 15
    when points >= 4000 then 14
    when points >= 3500 then 13
    when points >= 3000 then 12
    when points >= 2500 then 11
    when points >= 2000 then 10
    when points >= 1750 then 9
    when points >= 1500 then 8
    when points >= 1250 then 7
    when points >= 1000 then 6
    when points >= 500 then 5
    when points >= 375 then 4
    when points >= 250 then 3
    when points >= 100 then 2
    else 1
  end
$fn$;

create or replace function public.apply_completion_progression(
  p_profile uuid,
  p_quest_id uuid,
  p_idem uuid,
  p_started timestamptz,
  p_completed timestamptz,
  p_day date,
  p_duration int,
  p_base_xp int,
  p_categories text[],
  p_advance_journey boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$

declare
  v_idem uuid;
  v_day date;

  v_xp_quest int;
  v_qdur int;
  v_qcats text[];

  v_existing_payload jsonb;

  v_day_count bigint;
  v_week date;
  v_week_count bigint;

  v_first_count bigint;
  v_week_days bigint;
  v_week_days_before bigint;

  v_total bigint;
  v_level int;
  v_streak int;
  v_streak_before int;
  v_longest int;
  v_last_day date;
  v_quests int;

  v_daily int;
  v_weekly int;
  v_first int;
  v_perfect int;
  v_streak_xp int;
  v_granted int;

  v_xp int;
  v_new_total bigint;
  v_new_level int;
  v_new_quests int;
  v_chapter_before int;
  v_chapter_after int;

  v_track text;
  v_before_pts int;
  v_after_pts int;
  v_pts int;
  v_mastery jsonb := '[]'::jsonb;
  v_mastered text[] := '{}';

  v_completion_id uuid;
  v_payload jsonb;

  -- S5-02: newly-unlocked sets (achievements + cosmetics) returned to the client.
  v_achievements jsonb := '[]'::jsonb;
  v_cosmetics jsonb := '[]'::jsonb;
  v_r record;
begin
  -- Replay: an event already stored for this profile+key is a no-op
  -- that returns the stored payload (idempotency under redelivery/in-flight).
  select qc.bonus_breakdown
    into v_existing_payload
    from public.quest_completions qc
   where qc.profile_id = p_profile and qc.idempotency_key = p_idem
   limit 1;
  if v_existing_payload is not null then
    return v_existing_payload;
  end if;

  -- Insert the row, then count on stored rows (the DB is the source).
  insert into public.quest_completions
    (profile_id, quest_id, idempotency_key, started_at, completed_at, duration_sec, day_key)
  values
    (p_profile, p_quest_id, p_idem, p_started, p_completed, p_duration, p_day::text)
  returning id into v_completion_id;

  -- Server-only math ----------------------------------------------------------

  -- Current progression snapshot.
  select p.total_xp, p.level, p.current_streak, p.longest_streak, p.last_completed_day, p.journey_quests
    into v_total, v_level, v_streak, v_longest, v_last_day, v_quests
    from public.profiles p
   where p.id = p_profile;
  v_total := coalesce(v_total, 0);
  v_level := coalesce(v_level, 1);
  v_streak := coalesce(v_streak, 0);
  v_longest := coalesce(v_longest, 0);
  v_quests := coalesce(v_quests, 0);

  -- Daily bonus: +150 on the first completion of this local day.
  select count(*) into v_day_count
    from public.quest_completions qc
   where qc.profile_id = p_profile and qc.day_key = p_day::text;
  v_daily := case when v_day_count = 1 then 150 else 0 end;

  -- Weekly bonus: +1000 on exactly the 3rd completion in the Mon-Sun local week
  -- of this event's day_key (Ref 08 isSameWeek semantics: the day key is a local
  -- calendar date; Monday of week = day - (ISO_dow - 1)).
  v_week := p_day - (extract(isodow from p_day)::int - 1);
  select count(*) into v_week_count
    from public.quest_completions qc
   where qc.profile_id = p_profile
     and (qc.day_key::date - (extract(isodow from qc.day_key::date)::int - 1)) = v_week;
  v_weekly := case when v_week_count = 3 then 1000 else 0 end;

  -- First-clear: +50 the first time this profile completes this quest row.
  -- The just-inserted row is counted, so exactly 1 means first ever.
  select count(*) into v_first_count
    from public.quest_completions qc
   where qc.profile_id = p_profile and qc.quest_id = p_quest_id;
  v_first := case when v_first_count = 1 then 50 else 0 end;

  -- Perfect week: +1500 when this completion completes all 7 distinct local
  -- days of the Mon-Sun week. The set must be complete including this row
  -- but incomplete without it, so backfills and late arrivals pay exactly once.
  select count(distinct qc.day_key) into v_week_days
    from public.quest_completions qc
   where qc.profile_id = p_profile
     and (qc.day_key::date - (extract(isodow from qc.day_key::date)::int - 1)) = v_week;
  select count(distinct qc.day_key) into v_week_days_before
    from public.quest_completions qc
   where qc.profile_id = p_profile and qc.id <> v_completion_id
     and (qc.day_key::date - (extract(isodow from qc.day_key::date)::int - 1)) = v_week;
  v_perfect := case when v_week_days = 7 and v_week_days_before = 6 then 1500 else 0 end;

  -- Streak: same day keeps, consecutive next day climbs, a gap restarts at 1.
  v_streak_before := v_streak;
  if v_last_day is null then
    v_streak := 1;
  elsif p_day = v_last_day then
    v_streak := v_streak_before;
  elsif p_day = v_last_day + 1 then
    v_streak := v_streak_before + 1;
  else
    v_streak := 1;
  end if;
  v_longest := greatest(v_longest, v_streak);

  -- Streak milestone: 50/150/500/1500/3500/6000 at a fresh
  -- 3/7/30/100/200/365-day streak, exactly once per milestone (the unique
  -- (profile_id, reward_day) is the gate).
  v_streak_xp := 0;
  if v_streak in (3, 7, 30, 100, 200, 365) and v_streak > v_streak_before then
    insert into public.streaks_rewards (profile_id, reward_day)
    values (p_profile, v_streak)
    on conflict (profile_id, reward_day) do nothing
    returning reward_day into v_granted;
    if v_granted is not null then
      v_streak_xp := case v_granted
        when 3 then 50
        when 7 then 150
        when 30 then 500
        when 100 then 1500
        when 200 then 3500
        else 6000
      end;
    end if;
  end if;

  -- Totals + level + journey.
  v_xp := p_base_xp + v_daily + v_weekly + v_first + v_perfect + v_streak_xp;
  v_new_total := v_total + v_xp;
  v_new_level := public.level_for_xp(v_new_total);
  while 50::bigint * v_new_level * (v_new_level - 1) > v_new_total loop
    v_new_level := v_new_level - 1;
  end loop;
  while 50::bigint * (v_new_level + 1) * v_new_level <= v_new_total loop
    v_new_level := v_new_level + 1;
  end loop;

  if p_advance_journey then
    v_new_quests := v_quests + 1;
  else
    v_new_quests := v_quests;
  end if;
  v_chapter_before := public.chapter_for_quests(v_quests);
  v_chapter_after := public.chapter_for_quests(v_new_quests);

  -- Mastery (FR-MAS-2): +30 per touched strength/endurance/mobility, +15 discipline (AT-02H).
  for v_track in
    select t.track
      from (values ('strength'::text), ('endurance'), ('mobility')) as t(track)
  loop
    if not (p_categories @> array[v_track]) then
      continue;
    end if;
    select coalesce((
      select m.points from public.mastery m
       where m.profile_id = p_profile and m.track = v_track), 0)
      into v_before_pts;
    insert into public.mastery (profile_id, track, points)
    values (p_profile, v_track, 30)
    on conflict (profile_id, track)
    do update set points = public.mastery.points + 30
    returning points into v_after_pts;
    v_mastered := array_append(v_mastered, v_track);
    v_mastery := v_mastery || jsonb_build_object(
      'track', v_track,
      'points_before', v_before_pts,
      'points_after', v_after_pts,
      'level_before', public.mastery_level_for_points(v_before_pts),
      'level_after', public.mastery_level_for_points(v_after_pts)
    );
  end loop;

  select coalesce((
      select m.points from public.mastery m
       where m.profile_id = p_profile and m.track = 'discipline'), 0)
    into v_before_pts;
  insert into public.mastery (profile_id, track, points)
  values (p_profile, 'discipline', 15)
  on conflict (profile_id, track)
  do update set points = public.mastery.points + 15
  returning points into v_after_pts;
  v_mastered := array_append(v_mastered, 'discipline');
  v_mastery := v_mastery || jsonb_build_object(
    'track', 'discipline',
    'points_before', v_before_pts,
    'points_after', v_after_pts,
    'level_before', public.mastery_level_for_points(v_before_pts),
    'level_after', public.mastery_level_for_points(v_after_pts)
  );

  -- Commit progression to the server-owned row (the RPC is the only
  -- writer; the profile guard is bypassed by SECURITY DEFINER at the table
  -- owner role).
  update public.profiles
     set total_xp = v_new_total,
         level = v_new_level,
         current_streak = v_streak,
         longest_streak = v_longest,
         last_completed_day = p_day,
         journey_quests = v_new_quests,
         current_chapter = v_chapter_after,
         updated_at = now()
   where id = p_profile;

  -- Achievements (S5-02, ED-21): score every un-owned rule against the
  -- post-math state; the unique (profile_id, achievement_id) insert is the
  -- exactly-once gate, and only rows the insert actually created (RETURNING)
  -- enter the payload. Replay path is untouched — a stored payload returns
  -- before any of this runs, so a re-delivered event never double-unlocks.
  with unlocked as (
    insert into public.profile_achievements (profile_id, achievement_id, unlocked_at)
    select p_profile, a.id, now()
      from public.achievements a
     where a.unlock_rule ? 'kind'
       and not exists (
         select 1 from public.profile_achievements pa
          where pa.profile_id = p_profile and pa.achievement_id = a.id
       )
       and case a.unlock_rule ->> 'kind'
             when 'quests' then
               v_new_quests >= coalesce((a.unlock_rule ->> 'count')::int, 0)
             when 'level' then
               v_new_level >= coalesce((a.unlock_rule ->> 'level')::int, 0)
             when 'mastery' then
               public.mastery_level_for_points(coalesce((
                 select m.points from public.mastery m
                  where m.profile_id = p_profile
                    and m.track = a.unlock_rule ->> 'track'
               ), 0)) >= coalesce((a.unlock_rule ->> 'level')::int, 0)
             when 'streak' then
               v_streak >= coalesce((a.unlock_rule ->> 'days')::int, 0)
             when 'distinct-days' then
               (
                 select count(*)
                   from (select distinct qc.day_key
                           from public.quest_completions qc
                          where qc.profile_id = p_profile) distinct_days
               ) >= coalesce((a.unlock_rule ->> 'count')::int, 0)
             when 'gap-days' then
               v_last_day is not null
               and p_day - v_last_day >= coalesce((a.unlock_rule ->> 'days')::int, 0) + 1
             when 'hour-before' then
               (
                 select count(*)
                   from public.quest_completions qc
                  where qc.profile_id = p_profile
                    and to_char(qc.started_at at time zone 'UTC', 'HH24')::int
                        < coalesce((a.unlock_rule ->> 'hour')::int, 0)
               ) >= coalesce((a.unlock_rule ->> 'count')::int, 0)
             when 'hour-after' then
               (
                 select count(*)
                   from public.quest_completions qc
                  where qc.profile_id = p_profile
                    and to_char(qc.started_at at time zone 'UTC', 'HH24')::int
                        >= coalesce((a.unlock_rule ->> 'hour')::int, 0)
               ) >= coalesce((a.unlock_rule ->> 'count')::int, 0)
             else false
           end
     on conflict (profile_id, achievement_id) do nothing
     returning achievement_id, unlocked_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.achievement_id,
    'slug', a.slug,
    'title', a.title,
    'category', a.category,
    'unlocked_at', u.unlocked_at
  ) order by a.title asc), '[]'::jsonb)
    into v_achievements
    from unlocked u
    join public.achievements a on a.id = u.achievement_id;

  -- Cosmetics (S5-02): level/chapter threshold rules score against the
  -- new profile, achievement-slot rules against achievements the player OWNS at
  -- this point (Step 7 already ran), so unlock chains (e.g. a 'title-adventurer'
  -- on the same completion as the 'first-quest' achievement) resolve in one call.
  with unlocked as (
    insert into public.profile_cosmetics (profile_id, cosmetic_id, unlocked_at)
    select p_profile, c.id, now()
      from public.cosmetics c
     where c.unlock_rule ? 'kind'
       and not exists (
         select 1 from public.profile_cosmetics pc
          where pc.profile_id = p_profile and pc.cosmetic_id = c.id
       )
       and case c.unlock_rule ->> 'kind'
         when 'level' then
           v_new_level >= coalesce((c.unlock_rule ->> 'level')::int, 0)
         when 'chapter' then
           v_chapter_after >= coalesce((c.unlock_rule ->> 'chapter')::int, 0)
         when 'achievement' then
           exists (
             select 1
               from public.profile_achievements pa
               join public.achievements a on a.id = pa.achievement_id
              where pa.profile_id = p_profile and a.slug = c.unlock_rule ->> 'slug'
           )
         else false
       end
     on conflict (profile_id, cosmetic_id) do nothing
     returning cosmetic_id, unlocked_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.cosmetic_id,
    'slug', c.slug,
    'type', c.type,
    'name', c.name,
    'unlocked_at', u.unlocked_at
  ) order by c.created_at desc), '[]'::jsonb)
    into v_cosmetics
    from unlocked u
    join public.cosmetics c on c.id = u.cosmetic_id;

  -- Payload (Ref 05 — dim) and commit to the stored completion row.
  v_payload := jsonb_build_object(
    'xp', jsonb_build_object(
      'quest', p_base_xp,
      'daily', v_daily,
      'weekly', v_weekly,
      'first', v_first,
      'perfect', v_perfect,
      'streak', v_streak_xp,
      'total', v_xp
    ),
    'level', jsonb_build_object(
      'before', v_level,
      'after', v_new_level,
      'title', public.level_title(v_new_level)
    ),
    'mastery', v_mastery,
    'achievements', v_achievements,
    'cosmetics', v_cosmetics,
    'journey', jsonb_build_object(
      'quests', v_new_quests,
      'chapter_before', v_chapter_before,
      'chapter_after', v_chapter_after,
      'next_threshold', public.next_journey_threshold(v_new_quests)
    ),
    'streak', jsonb_build_object('current', v_streak, 'longest', v_longest)
  );

  update public.quest_completions
     set xp_awarded = v_xp,
         mastered = v_mastered,
         bonus_breakdown = v_payload
   where id = v_completion_id;

  return v_payload;
end;
$$;

-- Big-3 Master Badges: Level-10 per-track achievements, scored by the new
-- 'mastery' rule kind above (post-accrual points through the 0047 curve).
-- The 0005 category CHECK predates the 'mastery' shelf: widen it first.
alter table public.achievements drop constraint if exists achievements_category_check;
alter table public.achievements
  add constraint achievements_category_check
  check (category in ('beginner', 'progress', 'consistency', 'special', 'mastery'));
insert into public.achievements (slug, title, description, hint, category, rarity, unlock_rule) values
  ('mastery-strength-10', 'Strength Master', 'Reach Strength mastery level 10.', 'The iron remembers your name.', 'mastery', 'Legendary', '{"kind":"mastery","track":"strength","level":10}'),
  ('mastery-endurance-10', 'Endurance Master', 'Reach Endurance mastery level 10.', 'Mile by mile, unstoppable.', 'mastery', 'Legendary', '{"kind":"mastery","track":"endurance","level":10}'),
  ('mastery-mobility-10', 'Mobility Master', 'Reach Mobility mastery level 10.', 'Move well, move often.', 'mastery', 'Legendary', '{"kind":"mastery","track":"mobility","level":10}'),
  ('mastery-discipline-10', 'Discipline Master', 'Reach Discipline mastery level 10.', 'Showing up is the skill.', 'mastery', 'Legendary', '{"kind":"mastery","track":"discipline","level":10}')
on conflict (slug) do nothing;

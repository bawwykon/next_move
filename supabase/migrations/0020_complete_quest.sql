-- S5-01: server-authoritative completion RPC (Ref 06 §complete_quest, Ref 08).
-- Single SECURITY DEFINER function; the whole call is one implicit transaction
-- (plpgsql has no COMMIT inside a function; any RAISE rolls the statement back).
-- The client sends only an event { quest_id, idempotency_key, started_at,
-- completed_at, day_key } — every XP/level/streak/mastery figure is recomputed
-- server-side from the quest row, the profile row and this profile's own rows.
--
-- Product curves (keep in lock-step with the client where mirrored):
--   level curve (FR-XP-2): 100 x L XP to reach level L + 1
--   mastery points (FR-MAS-2): +10 per touched strength/endurance/mobility
--     category, +5 discipline on every completion
--   mastery level: same cumulative curve shape as the level curve
--   journey chapters (FR-JOURNEY-4): 10/30/60/100/200/365 completions
--   level titles: 1 Novice, 2 Apprentice, 3 Squire, 4 Adventurer,
--     5-9 Explorer, 10-24 Trailblazer, 25-49 Voyager, 50-99 Champion, 100+ Legend

create or replace function public.level_for_xp(xp bigint)
returns int
language sql
immutable
as $fn$
  select greatest(1, floor((1 + sqrt(1 + 4::numeric * xp / 50::numeric)) / 2)::int)
$fn$;

create or replace function public.mastery_level_for_points(points bigint)
returns int
language sql
immutable
as $fn$
  select least(10, floor(points / 250) + 1)
$fn$;

create or replace function public.level_title(level int)
returns text
language sql
immutable
as $fn$
  select case
    when level >= 100 then 'Legend'
    when level >= 50 then 'Champion'
    when level >= 25 then 'Warrior'
    when level >= 10 then 'Adventurer'
    when level >= 5 then 'Apprentice'
    else 'Beginner'
  end
$fn$;

create or replace function public.chapter_for_quests(quests int)
returns int
language sql
immutable
as $fn$
  select case
    when quests >= 365 then 7
    when quests >= 200 then 6
    when quests >= 100 then 5
    when quests >= 60 then 4
    when quests >= 30 then 3
    when quests >= 10 then 2
    else 1
  end
$fn$;

create or replace function public.next_journey_threshold(quests int)
returns int
language sql
immutable
as $fn$
  select case
    when quests < 10 then 10
    when quests < 30 then 30
    when quests < 60 then 60
    when quests < 100 then 100
    when quests < 200 then 200
    when quests < 365 then 365
    else null
  end
$fn$;

create or replace function public.complete_quest(ev jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_quest_id uuid;
  v_idem uuid;
  v_started timestamptz;
  v_completed timestamptz;
  v_day date;
  v_elapsed double precision;

  v_xp_quest int;
  v_qdur int;
  v_qcats text[];

  v_existing_payload jsonb;

  v_day_count bigint;
  v_week date;
  v_week_count bigint;

  v_total bigint;
  v_level int;
  v_streak int;
  v_streak_before int;
  v_longest int;
  v_last_day date;
  v_quests int;

  v_daily int;
  v_weekly int;
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
begin
  -- Step 1 - auth (server-authoritative; the profile is the caller).
  v_profile := auth.uid();
  if v_profile is null then
    raise exception 'complete_quest.unknown' using errcode = 'F0001';
  end if;

  -- Event fields (the client cannot influence the math beyond these).
  v_quest_id := (ev->>'quest_id')::uuid;
  v_idem := (ev->>'idempotency_key')::uuid;
  v_started := (ev->>'started_at')::timestamptz;
  v_completed := (ev->>'completed_at')::timestamptz;
  v_day := (ev->>'day_key')::date;
  if v_quest_id is null or v_idem is null or v_started is null or v_completed is null or v_day is null then
    raise exception 'complete_quest.unknown' using errcode = 'F0001';
  end if;

  -- Step 2 - replay: an event already stored for this profile+key is a no-op
  -- that returns the stored payload (idempotency under redelivery/in-flight).
  select qc.bonus_breakdown
    into v_existing_payload
    from public.quest_completions qc
   where qc.profile_id = v_profile and qc.idempotency_key = v_idem
   limit 1;
  if v_existing_payload is not null then
    return v_existing_payload;
  end if;

  -- Step 3 - validate the quest exists, is active, and the duration is plausible.
  select q.xp_reward, q.duration_sec, q.categories
    into v_xp_quest, v_qdur, v_qcats
    from public.quests q
   where q.id = v_quest_id and q.active = true;
  if v_xp_quest is null then
    raise exception 'complete_quest.quest_invalid' using errcode = 'F0002';
  end if;

  v_elapsed := extract(epoch from (v_completed - v_started));
  if v_elapsed < v_qdur * 0.85 or v_elapsed > v_qdur * 1.15 then
    raise exception 'complete_quest.timer_mismatch' using errcode = 'F0003';
  end if;

  -- Step 4 - insert the row, then count on stored rows (the DB is the source).
  insert into public.quest_completions
    (profile_id, quest_id, idempotency_key, started_at, completed_at, duration_sec, day_key)
  values
    (v_profile, v_quest_id, v_idem, v_started, v_completed, v_qdur, v_day::text)
  returning id into v_completion_id;

  -- Step 5 - server-only math --------------------------------------------------

  -- Current progression snapshot.
  select p.total_xp, p.level, p.current_streak, p.longest_streak, p.last_completed_day, p.journey_quests
    into v_total, v_level, v_streak, v_longest, v_last_day, v_quests
    from public.profiles p
   where p.id = v_profile;
  v_total := coalesce(v_total, 0);
  v_level := coalesce(v_level, 1);
  v_streak := coalesce(v_streak, 0);
  v_longest := coalesce(v_longest, 0);
  v_quests := coalesce(v_quests, 0);

  -- Daily bonus: +75 on the first completion of this local day.
  select count(*) into v_day_count
    from public.quest_completions qc
   where qc.profile_id = v_profile and qc.day_key = v_day::text;
  v_daily := case when v_day_count = 1 then 75 else 0 end;

  -- Weekly bonus: +500 on exactly the 3rd completion in the Mon-Sun local week
  -- of this event's day_key (Ref 08 isSameWeek semantics: the day key is a local
  -- calendar date; Monday of week = day - (ISO_dow - 1)).
  v_week := v_day - (extract(isodow from v_day)::int - 1);
  select count(*) into v_week_count
    from public.quest_completions qc
   where qc.profile_id = v_profile
     and (qc.day_key::date - (extract(isodow from qc.day_key::date)::int - 1)) = v_week;
  v_weekly := case when v_week_count = 3 then 500 else 0 end;

  -- Streak: same day keeps, consecutive next day climbs, a gap restarts at 1.
  v_streak_before := v_streak;
  if v_last_day is null then
    v_streak := 1;
  elsif v_day = v_last_day then
    v_streak := v_streak_before;
  elsif v_day = v_last_day + 1 then
    v_streak := v_streak_before + 1;
  else
    v_streak := 1;
  end if;
  v_longest := greatest(v_longest, v_streak);

  -- Streak milestone: 50/150/500/1500 at a fresh 3/7/30/100-day streak, exactly
  -- once per milestone (the unique (profile_id, reward_day) is the gate).
  v_streak_xp := 0;
  if v_streak in (3, 7, 30, 100) and v_streak > v_streak_before then
    insert into public.streaks_rewards (profile_id, reward_day)
    values (v_profile, v_streak)
    on conflict (profile_id, reward_day) do nothing
    returning reward_day into v_granted;
    if v_granted is not null then
      v_streak_xp := case v_granted
        when 3 then 50
        when 7 then 150
        when 30 then 500
        else 1500
      end;
    end if;
  end if;

  -- Totals + level + journey.
  v_xp := v_xp_quest + v_daily + v_weekly + v_streak_xp;
  v_new_total := v_total + v_xp;
  v_new_level := public.level_for_xp(v_new_total);
  while 50::bigint * v_new_level * (v_new_level - 1) > v_new_total loop
    v_new_level := v_new_level - 1;
  end loop;
  while 50::bigint * (v_new_level + 1) * v_new_level <= v_new_total loop
    v_new_level := v_new_level + 1;
  end loop;

  v_new_quests := v_quests + 1;
  v_chapter_before := public.chapter_for_quests(v_quests);
  v_chapter_after := public.chapter_for_quests(v_new_quests);

  -- Mastery (FR-MAS-2): +10 per touched strength/endurance/mobility, +5 discipline.
  for v_track in
    select t.track
      from (values ('strength'::text), ('endurance'), ('mobility')) as t(track)
  loop
    if not (v_qcats @> array[v_track]) then
      continue;
    end if;
    select coalesce((
      select m.points from public.mastery m
       where m.profile_id = v_profile and m.track = v_track), 0)
      into v_before_pts;
    insert into public.mastery (profile_id, track, points)
    values (v_profile, v_track, 10)
    on conflict (profile_id, track)
    do update set points = public.mastery.points + 10
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
       where m.profile_id = v_profile and m.track = 'discipline'), 0)
    into v_before_pts;
  insert into public.mastery (profile_id, track, points)
  values (v_profile, 'discipline', 5)
  on conflict (profile_id, track)
  do update set points = public.mastery.points + 5
  returning points into v_after_pts;
  v_mastered := array_append(v_mastered, 'discipline');
  v_mastery := v_mastery || jsonb_build_object(
    'track', 'discipline',
    'points_before', v_before_pts,
    'points_after', v_after_pts,
    'level_before', public.mastery_level_for_points(v_before_pts),
    'level_after', public.mastery_level_for_points(v_after_pts)
  );

  -- Step 6 - payload (Ref 05 §#dim) and commit to the stored rows.
  v_payload := jsonb_build_object(
    'xp', jsonb_build_object(
      'quest', v_xp_quest,
      'daily', v_daily,
      'weekly', v_weekly,
      'streak', v_streak_xp,
      'total', v_new_total
    ),
    'level', jsonb_build_object(
      'before', v_level,
      'after', v_new_level,
      'title', public.level_title(v_new_level)
    ),
    'mastery', v_mastery,
    'achievements', '[]'::jsonb,
    'cosmetics', '[]'::jsonb,
    'journey', jsonb_build_object(
      'quests', v_new_quests,
      'chapter_before', v_chapter_before,
      'chapter_after', v_chapter_after,
      'next_threshold', public.next_journey_threshold(v_new_quests)
    ),
    'streak', jsonb_build_object('current', v_streak, 'longest', v_longest)
  );

  update public.profiles
     set total_xp = v_new_total,
         level = v_new_level,
         current_streak = v_streak,
         longest_streak = v_longest,
         last_completed_day = v_day,
         journey_quests = v_new_quests,
         current_chapter = v_chapter_after,
         updated_at = now()
   where id = v_profile;

  update public.quest_completions
     set xp_awarded = v_xp,
         mastered = v_mastered,
         bonus_breakdown = v_payload
   where id = v_completion_id;

  return v_payload;
end;
$$;

revoke all on function public.complete_quest(jsonb) from public;
grant execute on function public.complete_quest(jsonb) to authenticated;
grant execute on function public.complete_quest(jsonb) to service_role;
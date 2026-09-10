-- 0038_xp_and_custom_difficulty_rework.sql
-- XP Rebalance & Custom Quest Difficulty Rework

-- 1. Drop existing constraint first so we can update rewards freely
alter table public.quests drop constraint if exists quests_xp_reward_check;

-- 2. Update quest XP rewards for authored quests
update public.quests set xp_reward = 100 where difficulty = 'easy';
update public.quests set xp_reward = 200 where difficulty = 'normal';
update public.quests set xp_reward = 400 where difficulty = 'hard';

-- 3. Add new constraint allowing (100, 200, 400)
alter table public.quests add constraint quests_xp_reward_check check (xp_reward in (100, 200, 400));

-- 4. Update complete_custom_workout RPC with new validation and classification logic
create or replace function public.complete_custom_workout(p_workout_id uuid, ev jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
  v_idem uuid;
  v_started timestamptz;
  v_completed timestamptz;
  v_day date;

  v_segments jsonb;
  v_seg jsonb;
  v_seg_count int;

  v_existing_payload jsonb;

  v_slug text;
  v_dur int;
  v_difficulty text;
  v_ex_cats text[];
  v_cat text;
  v_total_sec int := 0;
  v_exercise_count int := 0;
  v_cats text[] := '{}';

  v_hard_sec int := 0;
  v_normal_count int := 0;
  v_base_xp int := 100;

  v_sentinel uuid;
  v_elapsed double precision;
begin
  -- Auth
  v_profile := auth.uid();
  if v_profile is null then
    raise exception 'complete_custom_workout.unknown' using errcode = 'F0001';
  end if;

  v_idem := (ev->>'idempotency_key')::uuid;
  v_started := (ev->>'started_at')::timestamptz;
  v_completed := (ev->>'completed_at')::timestamptz;
  v_day := (ev->>'day_key')::date;
  if p_workout_id is null or v_idem is null or v_started is null or v_completed is null or v_day is null then
    raise exception 'complete_custom_workout.unknown' using errcode = 'F0001';
  end if;

  select qc.bonus_breakdown
    into v_existing_payload
    from public.quest_completions qc
   where qc.profile_id = v_profile and qc.idempotency_key = v_idem
   limit 1;
  if v_existing_payload is not null then
    return v_existing_payload;
  end if;

  select cw.segments
    into v_segments
    from public.custom_workouts cw
   where cw.id = p_workout_id and cw.profile_id = v_profile;
  if v_segments is null or jsonb_typeof(v_segments) <> 'array' then
    raise exception 'complete_custom_workout.workout_invalid' using errcode = 'F0002';
  end if;

  v_seg_count := jsonb_array_length(v_segments);
  if v_seg_count < 1 or v_seg_count > 12 then
    raise exception 'complete_custom_workout.segment_cap' using errcode = 'F0002';
  end if;

  for v_seg in select * from jsonb_array_elements(v_segments)
  loop
    v_dur := (v_seg->>'duration_sec')::int;
    if v_dur is null then
      raise exception 'complete_custom_workout.segment_invalid' using errcode = 'F0002';
    end if;

    if coalesce(v_seg->>'kind', 'exercise') = 'rest' then
      if v_seg->>'exercise_slug' is not null then
        raise exception 'complete_custom_workout.segment_invalid' using errcode = 'F0002';
      end if;
      if v_dur <> 30 then
        raise exception 'complete_custom_workout.bad_duration' using errcode = 'F0002';
      end if;
      v_total_sec := v_total_sec + v_dur;
      continue;
    end if;

    v_slug := v_seg->>'exercise_slug';
    if v_slug is null then
      raise exception 'complete_custom_workout.segment_invalid' using errcode = 'F0002';
    end if;
    if v_dur not in (30, 45, 60) then
      raise exception 'complete_custom_workout.bad_duration' using errcode = 'F0002';
    end if;

    select e.difficulty,
           coalesce(e.categories, '{}'::text[])
      into v_difficulty, v_ex_cats
      from public.exercise_library e
     where e.slug = v_slug;
    if v_difficulty is null then
      raise exception 'complete_custom_workout.unknown_exercise' using errcode = 'F0002';
    end if;

    v_total_sec := v_total_sec + v_dur;
    v_exercise_count := v_exercise_count + 1;

    if v_difficulty = 'advanced' or v_slug in ('burpees', 'mountain-climber', 'bicycle-crunch') then
      v_hard_sec := v_hard_sec + v_dur;
    elsif v_difficulty = 'intermediate' then
      v_normal_count := v_normal_count + 1;
    end if;

    foreach v_cat in array v_ex_cats
    loop
      if v_cat in ('strength','endurance','mobility')
         and not (v_cats @> array[v_cat]) then
        v_cats := array_append(v_cats, v_cat);
      end if;
    end loop;
  end loop;

  if v_exercise_count = 0 then
    raise exception 'complete_custom_workout.no_exercise' using errcode = 'F0002';
  end if;

  if v_total_sec < 480 or v_total_sec > 900 then
    raise exception 'complete_custom_workout.length_bounds' using errcode = 'F0002';
  end if;

  v_elapsed := extract(epoch from (v_completed - v_started));
  if v_elapsed < v_total_sec * 0.85 or v_elapsed > v_total_sec * 1.15 then
    raise exception 'complete_custom_workout.timer_mismatch' using errcode = 'F0003';
  end if;

  -- Classification logic:
  -- Hard (400 XP): >= 45s of Hard exercise time
  -- OR >= 5 Normal/Intermediate exercises with 0 Hard exercises
  -- Normal (200 XP): >= 2 Normal/Intermediate exercises AND 0 Hard exercises
  -- Easy (100 XP): otherwise
  if v_hard_sec >= 45 then
    v_base_xp := 400;
  elsif v_normal_count >= 5 and v_hard_sec = 0 then
    v_base_xp := 400;
  elsif v_normal_count >= 2 and v_hard_sec = 0 then
    v_base_xp := 200;
  else
    v_base_xp := 100;
  end if;

  select q.id into v_sentinel
    from public.quests q
   where q.slug = 'custom-workout';
  if v_sentinel is null then
    raise exception 'complete_custom_workout.workout_invalid' using errcode = 'F0002';
  end if;

  return public.apply_completion_progression(
    p_profile => v_profile,
    p_quest_id => v_sentinel,
    p_idem => v_idem,
    p_started => v_started,
    p_completed => v_completed,
    p_day => v_day,
    p_duration => v_total_sec,
    p_base_xp => v_base_xp,
    p_categories => v_cats,
    p_advance_journey => false
  );
end;
$$;

grant execute on function public.complete_custom_workout(uuid, jsonb) to authenticated;
revoke execute on function public.complete_custom_workout(uuid, jsonb) from anon;

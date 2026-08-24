-- WK ruling 2026-08-22 - rest blocks for custom workouts.
--
-- A saved segment may now carry kind:'rest' with a null exercise_slug:
--   * it contributes ZERO points (the meter freezes while it runs),
--   * but it still counts toward the total time and the 12-segment cap,
--   * its duration must come from the rest preset set (15/30/45/60).
-- Segments without a kind keep reading as exercises (rows saved before
-- this migration stay valid), with the original 30/45/60/90 whitelist.

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
  v_weight int;
  v_ex_cats text[];
  v_cat text;
  v_total_sec int := 0;
  v_exercise_count int := 0;
  v_points numeric := 0;
  v_cats text[] := '{}';

  v_sentinel uuid;
  v_elapsed double precision;
begin
  -- Auth (server-authoritative; the profile is the caller).
  v_profile := auth.uid();
  if v_profile is null then
    raise exception 'complete_custom_workout.unknown' using errcode = 'F0001';
  end if;

  -- Event fields (no quest_id: the workout id carries the identity).
  v_idem := (ev->>'idempotency_key')::uuid;
  v_started := (ev->>'started_at')::timestamptz;
  v_completed := (ev->>'completed_at')::timestamptz;
  v_day := (ev->>'day_key')::date;
  if p_workout_id is null or v_idem is null or v_started is null or v_completed is null or v_day is null then
    raise exception 'complete_custom_workout.unknown' using errcode = 'F0001';
  end if;

  -- Replay first: a stored payload returns even if the workout was deleted
  -- after the original call (idempotency under redelivery/in-flight).
  select qc.bonus_breakdown
    into v_existing_payload
    from public.quest_completions qc
   where qc.profile_id = v_profile and qc.idempotency_key = v_idem
   limit 1;
  if v_existing_payload is not null then
    return v_existing_payload;
  end if;

  -- The workout must exist AND belong to the caller; segments come only from
  -- the saved row (the client cannot influence the math beyond the envelope).
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

  -- Structural validation + weighted point total over the saved definition.
  for v_seg in select * from jsonb_array_elements(v_segments)
  loop
    v_dur := (v_seg->>'duration_sec')::int;
    if v_dur is null then
      raise exception 'complete_custom_workout.segment_invalid' using errcode = 'F0002';
    end if;

    if coalesce(v_seg->>'kind', 'exercise') = 'rest' then
      -- Rest block: no slug allowed, rest presets only, fills time but not XP.
      if v_seg->>'exercise_slug' is not null then
        raise exception 'complete_custom_workout.segment_invalid' using errcode = 'F0002';
      end if;
      if v_dur not in (15, 30, 45, 60) then
        raise exception 'complete_custom_workout.bad_duration' using errcode = 'F0002';
      end if;
      v_total_sec := v_total_sec + v_dur;
      continue;
    end if;

    v_slug := v_seg->>'exercise_slug';
    if v_slug is null then
      raise exception 'complete_custom_workout.segment_invalid' using errcode = 'F0002';
    end if;
    if v_dur not in (30, 45, 60, 90) then
      raise exception 'complete_custom_workout.bad_duration' using errcode = 'F0002';
    end if;
    select case e.difficulty
             when 'beginner' then 1
             when 'intermediate' then 2
             else 3
           end,
           coalesce(e.categories, '{}'::text[])
      into v_weight, v_ex_cats
      from public.exercise_library e
     where e.slug = v_slug;
    if v_weight is null then
      raise exception 'complete_custom_workout.unknown_exercise' using errcode = 'F0002';
    end if;
    v_total_sec := v_total_sec + v_dur;
    v_exercise_count := v_exercise_count + 1;
    v_points := v_points + v_dur::numeric / 30.0 * v_weight;
    foreach v_cat in array v_ex_cats
    loop
      if v_cat in ('strength','endurance','mobility')
         and not (v_cats @> array[v_cat]) then
        v_cats := array_append(v_cats, v_cat);
      end if;
    end loop;
  end loop;

  -- BYQ-06a: a custom workout must contain at least one exercise segment.
  -- All-rest definitions are structurally valid but earn nothing and are
  -- nonsense content; the builder already can't ship them (picker only adds
  -- exercises), so this is the server backstop.
  if v_exercise_count = 0 then
    raise exception 'complete_custom_workout.no_exercise' using errcode = 'F0002';
  end if;

  -- Length window: 120..900 seconds across the whole workout (rests included).
  if v_total_sec < 120 or v_total_sec > 900 then
    raise exception 'complete_custom_workout.length_bounds' using errcode = 'F0002';
  end if;

  -- Wall-clock plausibility, mirroring the quest path's +/-15% gate.
  -- Rests run on the clock too, so the window covers them naturally.
  v_elapsed := extract(epoch from (v_completed - v_started));
  if v_elapsed < v_total_sec * 0.85 or v_elapsed > v_total_sec * 1.15 then
    raise exception 'complete_custom_workout.timer_mismatch' using errcode = 'F0003';
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
    p_base_xp => round(v_points * 3)::int,
    p_categories => v_cats,
    p_advance_journey => false
  );
end;
$$;

grant execute on function public.complete_custom_workout(uuid, jsonb) to authenticated;
revoke execute on function public.complete_custom_workout(uuid, jsonb) from anon;

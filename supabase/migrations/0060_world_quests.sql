-- 0060_world_quests.sql
-- JOURNEY-WORLD-QUESTS: weekly 3-objective adventure board docked on the Journey map.
--
-- Design notes (read before touching):
-- - Progress is RECOMPUTED from quest_completions, never incremented, so it
--   cannot drift from the authoritative completion log.
-- - complete_quest / complete_custom_workout are UNTOUCHED: the trigger fires
--   on quest_completions INSERT (both RPCs land there) and swallows its own
--   errors, so a forge-board bug can never break a completion payout.
-- - week_key is the Monday 'YYYY-MM-DD' of the completion's local day_key
--   (same Monday math as 0020/0024 — no ISO-year edge cases).
-- - Rewards mirror the canonical curves: level_for_xp + clamp loops (0027)
--   and the mastery upsert (+30, on conflict (profile_id, track)).

create table if not exists public.world_quests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_key text not null,
  objectives jsonb not null default '[]'::jsonb,
  rerolls_remaining int not null default 2,
  completed boolean not null default false,
  claimed boolean not null default false,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_quests_profile_week_unique unique (profile_id, week_key)
);

alter table public.world_quests enable row level security;

drop policy if exists "Users can read own world quests" on public.world_quests;
create policy "Users can read own world quests"
  on public.world_quests for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "Users can insert own world quests" on public.world_quests;
create policy "Users can insert own world quests"
  on public.world_quests for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "Users can update own world quests" on public.world_quests;
create policy "Users can update own world quests"
  on public.world_quests for update
  to authenticated
  using (profile_id = auth.uid());

-- Objective pool: key → goal. The single source of truth lives here; the
-- client mirrors it for display only. Objective JSON shape:
-- {"key": "wq_strength", "goal": 2, "progress": 0}
create or replace function public.world_quest_pool()
returns table (obj_key text, goal int)
language sql immutable
set search_path = public
as $$
  values ('wq_strength', 2),
         ('wq_endurance', 2),
         ('wq_mobility', 2),
         ('wq_discipline', 2),
         ('wq_any_3', 3),
         ('wq_days_3', 3),
         ('wq_hard_1', 1),
         ('wq_custom_1', 1);
$$;

-- Monday 'YYYY-MM-DD' of a local day_key (0020/0024 Monday math).
create or replace function public.world_quest_week_of(p_day text)
returns text
language sql immutable
set search_path = public
as $$
  select (p_day::date - (extract(isodow from p_day::date)::int - 1))::text;
$$;

-- Recomputed progress of one objective (capped at its goal). Unknown keys
-- score 0 instead of erroring (forward-compat with future pool additions).
create or replace function public.world_quest_objective_progress(
  p_profile uuid,
  p_week text,
  p_key text,
  p_goal int
)
returns int
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_monday text := (p_week::date)::text;
  v_next text := (p_week::date + 7)::text;
  v_count int := 0;
begin
  if p_key in ('wq_strength', 'wq_endurance', 'wq_mobility', 'wq_discipline') then
    select count(*) into v_count
      from public.quest_completions qc
      join public.quests q on q.id = qc.quest_id
     where qc.profile_id = p_profile
       and qc.day_key >= v_monday
       and qc.day_key < v_next
       and q.categories && array[split_part(p_key, '_', 2)];
  elsif p_key = 'wq_any_3' then
    select count(*) into v_count
      from public.quest_completions qc
     where qc.profile_id = p_profile
       and qc.day_key >= v_monday
       and qc.day_key < v_next;
  elsif p_key = 'wq_days_3' then
    select count(distinct qc.day_key) into v_count
      from public.quest_completions qc
     where qc.profile_id = p_profile
       and qc.day_key >= v_monday
       and qc.day_key < v_next;
  elsif p_key = 'wq_hard_1' then
    select count(*) into v_count
      from public.quest_completions qc
      join public.quests q on q.id = qc.quest_id
     where qc.profile_id = p_profile
       and qc.day_key >= v_monday
       and qc.day_key < v_next
       and q.difficulty = 'hard';
  elsif p_key = 'wq_custom_1' then
    select count(*) into v_count
      from public.quest_completions qc
      join public.quests q on q.id = qc.quest_id
     where qc.profile_id = p_profile
       and qc.day_key >= v_monday
       and qc.day_key < v_next
       and q.slug = 'custom-workout';
  else
    return 0;
  end if;
  return least(v_count, p_goal);
end;
$$;

-- Recompute every objective of a row from the completion log. Goals follow
-- the pool (authoritative); unknown keys keep stored progress.
create or replace function public.refresh_world_quests(p_profile uuid, p_week text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.world_quests%rowtype;
  v_item jsonb;
  v_new jsonb := '[]'::jsonb;
  v_key text;
  v_goal int;
  v_prog int;
  v_all bool := true;
begin
  select * into v_row
    from public.world_quests
   where profile_id = p_profile and week_key = p_week;
  if not found then
    return;
  end if;
  for v_item in select * from jsonb_array_elements(v_row.objectives) loop
    v_key := v_item ->> 'key';
    select p.goal into v_goal from public.world_quest_pool() p where p.obj_key = v_key;
    if found then
      v_prog := public.world_quest_objective_progress(p_profile, p_week, v_key, v_goal);
    else
      v_goal := coalesce((v_item ->> 'goal')::int, 0);
      v_prog := coalesce((v_item ->> 'progress')::int, 0);
    end if;
    if v_prog < v_goal then
      v_all := false;
    end if;
    v_new := v_new || jsonb_build_object('key', v_key, 'goal', v_goal, 'progress', v_prog);
  end loop;
  update public.world_quests
     set objectives = v_new,
         completed = v_all,
         updated_at = now()
   where id = v_row.id;
end;
$$;

-- Internal ensure (explicit profile): insert 3 random distinct objectives for
-- the week when missing, then backfill progress from banked completions.
create or replace function public.ensure_world_quests_for(p_profile uuid, p_week text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile is null then
    return;
  end if;
  if p_week !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'bad week_key';
  end if;
  perform p_week::date;
  insert into public.world_quests (profile_id, week_key, objectives, rerolls_remaining)
  select p_profile,
         p_week,
         (select jsonb_agg(
                   jsonb_build_object('key', p.obj_key, 'goal', p.goal, 'progress', 0)
                   order by p.r
                 )
            from (select pool.obj_key, pool.goal, random() as r
                    from public.world_quest_pool() pool
                   order by random()
                   limit 3) p),
         2
  on conflict (profile_id, week_key) do nothing;
  perform public.refresh_world_quests(p_profile, p_week);
end;
$$;

-- Client-facing ensure for the caller's own row; returns the row as JSON.
create or replace function public.ensure_world_quests(p_week text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := auth.uid();
  v_row public.world_quests%rowtype;
begin
  if v_profile is null then
    raise exception 'signed out';
  end if;
  perform public.ensure_world_quests_for(v_profile, p_week);
  select * into v_row
    from public.world_quests
   where profile_id = v_profile and week_key = p_week;
  return to_jsonb(v_row);
end;
$$;

-- Reroll one incomplete objective: random replacement outside the current 3,
-- progress recomputed, counter decremented.
create or replace function public.reroll_world_quest(p_week text, p_index int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := auth.uid();
  v_row public.world_quests%rowtype;
  v_item jsonb;
  v_new jsonb := '[]'::jsonb;
  v_cur text[] := '{}';
  v_new_key text;
  v_goal int;
  v_prog int;
  v_all bool := true;
  v_i int := 0;
begin
  if v_profile is null then
    raise exception 'signed out';
  end if;
  if p_week !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'bad week_key';
  end if;
  perform p_week::date;
  select * into v_row
    from public.world_quests
   where profile_id = v_profile and week_key = p_week
     for update;
  if not found then
    raise exception 'no row';
  end if;
  if v_row.claimed then
    raise exception 'claimed';
  end if;
  if v_row.rerolls_remaining <= 0 then
    raise exception 'no rerolls';
  end if;
  if p_index < 0 or p_index >= jsonb_array_length(v_row.objectives) then
    raise exception 'bad index';
  end if;
  v_item := v_row.objectives -> p_index;
  if coalesce((v_item ->> 'progress')::int, 0) >= coalesce((v_item ->> 'goal')::int, 0) then
    raise exception 'complete';
  end if;
  for v_item in select * from jsonb_array_elements(v_row.objectives) loop
    v_cur := v_cur || (v_item ->> 'key');
  end loop;
  select p.obj_key into v_new_key
    from public.world_quest_pool() p
   where not (p.obj_key = any (v_cur))
   order by random()
   limit 1;
  if not found then
    raise exception 'no alternatives';
  end if;
  select p.goal into v_goal from public.world_quest_pool() p where p.obj_key = v_new_key;
  for v_item in select * from jsonb_array_elements(v_row.objectives) loop
    if v_i = p_index then
      v_prog := public.world_quest_objective_progress(v_profile, p_week, v_new_key, v_goal);
      if v_prog < v_goal then
        v_all := false;
      end if;
      v_new := v_new || jsonb_build_object('key', v_new_key, 'goal', v_goal, 'progress', v_prog);
    else
      if coalesce((v_item ->> 'progress')::int, 0) < coalesce((v_item ->> 'goal')::int, 0) then
        v_all := false;
      end if;
      v_new := v_new || v_item;
    end if;
    v_i := v_i + 1;
  end loop;
  update public.world_quests
     set objectives = v_new,
         rerolls_remaining = rerolls_remaining - 1,
         completed = v_all,
         updated_at = now()
   where id = v_row.id
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- Jackpot claim: +500 XP (canonical level curve) +30 mastery ×4 tracks.
-- Achievement scoring stays on the completion path (unchanged); the next
-- completion re-scores level/mastery rules against this payout.
create or replace function public.claim_world_quests_reward(p_week text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := auth.uid();
  v_row public.world_quests%rowtype;
  v_item jsonb;
  v_total bigint;
  v_level int;
  v_track text;
  v_before int;
  v_after int;
  v_mastery jsonb := '[]'::jsonb;
begin
  if v_profile is null then
    raise exception 'signed out';
  end if;
  if p_week !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'bad week_key';
  end if;
  perform p_week::date;
  select * into v_row
    from public.world_quests
   where profile_id = v_profile and week_key = p_week
     for update;
  if not found then
    raise exception 'no row';
  end if;
  if v_row.claimed then
    raise exception 'claimed';
  end if;
  perform public.refresh_world_quests(v_profile, p_week);
  select * into v_row
    from public.world_quests
   where profile_id = v_profile and week_key = p_week;
  for v_item in select * from jsonb_array_elements(v_row.objectives) loop
    if coalesce((v_item ->> 'progress')::int, 0) < coalesce((v_item ->> 'goal')::int, 0) then
      raise exception 'incomplete';
    end if;
  end loop;
  select p.total_xp into v_total from public.profiles p where p.id = v_profile;
  v_total := coalesce(v_total, 0) + 500;
  v_level := public.level_for_xp(v_total);
  while 50::bigint * v_level * (v_level - 1) > v_total loop
    v_level := v_level - 1;
  end loop;
  while 50::bigint * (v_level + 1) * v_level <= v_total loop
    v_level := v_level + 1;
  end loop;
  for v_track in
    select t.track
      from (values ('strength'::text), ('endurance'), ('mobility'), ('discipline')) as t(track)
  loop
    select coalesce((
      select m.points from public.mastery m
       where m.profile_id = v_profile and m.track = v_track), 0)
      into v_before;
    insert into public.mastery (profile_id, track, points)
    values (v_profile, v_track, 30)
    on conflict (profile_id, track)
    do update set points = public.mastery.points + 30
    returning points into v_after;
    v_mastery := v_mastery || jsonb_build_object('track', v_track, 'points_after', v_after);
  end loop;
  update public.profiles
     set total_xp = v_total,
         level = v_level,
         updated_at = now()
   where id = v_profile;
  update public.world_quests
     set claimed = true,
         claimed_at = now(),
         completed = true,
         updated_at = now()
   where id = v_row.id;
  return jsonb_build_object(
    'xp_awarded', 500,
    'new_total', v_total,
    'new_level', v_level,
    'mastery', v_mastery
  );
end;
$$;

-- Completion hook: both completion RPCs land in quest_completions, so one
-- trigger covers authored + custom quests. It can NEVER fail the payout:
-- every forge-board error is swallowed by design.
create or replace function public.world_quests_on_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week text;
begin
  begin
    v_week := public.world_quest_week_of(NEW.day_key);
    perform public.ensure_world_quests_for(NEW.profile_id, v_week);
    perform public.refresh_world_quests(NEW.profile_id, v_week);
  exception when others then
    null;
  end;
  return NEW;
end;
$$;

drop trigger if exists world_quests_on_completion on public.quest_completions;
create trigger world_quests_on_completion
  after insert on public.quest_completions
  for each row
  execute function public.world_quests_on_completion();

grant execute on function public.ensure_world_quests(text) to authenticated;
grant execute on function public.ensure_world_quests(text) to service_role;
grant execute on function public.reroll_world_quest(text, int) to authenticated;
grant execute on function public.reroll_world_quest(text, int) to service_role;
grant execute on function public.claim_world_quests_reward(text) to authenticated;
grant execute on function public.claim_world_quests_reward(text) to service_role;

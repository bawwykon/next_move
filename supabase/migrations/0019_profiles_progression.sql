-- S5-01 (Ref 05 §2): server-owned progression columns on profiles.
-- The complete_quest RPC (0020) is the ONLY writer for these columns; the
-- client keeps update-own on its own mutable fields (display_name, equipment),
-- so RLS stays select/update-own. A guard trigger below blocks non-RPC updates
-- to the progression columns so a client can never tamper with XP/level/streaks
-- (server-authoritative trust model, S5-01 core).
alter table public.profiles
  add column if not exists total_xp bigint not null default 0,
  add column if not exists level int not null default 1,
  add column if not exists current_streak int not null default 0,
  add column if not exists longest_streak int not null default 0,
  add column if not exists last_completed_day date,
  add column if not exists journey_quests int not null default 0,
  add column if not exists current_chapter int not null default 1,
  add column if not exists equipped_frame uuid,
  add column if not exists equipped_title uuid,
  add column if not exists equipped_background uuid,
  add column if not exists equipped_portrait uuid;

-- Guard: only the complete_quest RPC (SECURITY DEFINER, running as the table
-- owner) and the trusted service_role may mutate the progression columns. Direct
-- client UPDATEs (authenticated role) that touch any progression column are
-- rejected — the service role is server-side only and is never exposed to a
-- device token, so allowing it keeps dev/ops tooling working without widening
-- the trust boundary for clients.
create or replace function public.protect_progression()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('postgres', 'service_role') then
    return new;
  end if;
  if new.total_xp is distinct from old.total_xp
     or new.level is distinct from old.level
     or new.current_streak is distinct from old.current_streak
     or new.longest_streak is distinct from old.longest_streak
     or new.last_completed_day is distinct from old.last_completed_day
     or new.journey_quests is distinct from old.journey_quests
     or new.current_chapter is distinct from old.current_chapter then
    raise exception 'progression_update_forbidden'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_progression on public.profiles;
create trigger protect_profiles_progression
  before update on public.profiles
  for each row
  execute function public.protect_progression();
-- BYQ-01 - custom workouts data layer (Phase 2 "Build Your Quest", Ref 12).
-- A custom workout is the player's own saved segment list; the server-owned
-- completion math stays in complete_quest/BYQ-02's RPC - this table only
-- stores the definition. Strict own-row RLS: full CRUD for the owner, nothing
-- for anyone else (service role bypasses for admin tooling).

create table public.custom_workouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  segments jsonb not null check (jsonb_typeof(segments) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.custom_workouts is
  'BYQ-01: player-built workouts. segments = [{exercise_slug, duration_sec}]; validated server-side at completion time (BYQ-02).';

alter table public.custom_workouts enable row level security;

create policy custom_workouts_select_own on public.custom_workouts
  for select to authenticated
  using (profile_id = auth.uid());

create policy custom_workouts_insert_own on public.custom_workouts
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy custom_workouts_update_own on public.custom_workouts
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy custom_workouts_delete_own on public.custom_workouts
  for delete to authenticated
  using (profile_id = auth.uid());

revoke all on public.custom_workouts from anon;
revoke all on public.custom_workouts from authenticated;
grant select, insert, update, delete on public.custom_workouts to authenticated;
grant select, insert, update, delete on public.custom_workouts to service_role;

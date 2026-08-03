create table if not exists public.mastery (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  track text not null check (track in ('strength', 'endurance', 'mobility', 'discipline')),
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, track)
);

alter table public.mastery enable row level security;

grant select on public.mastery to authenticated;

create policy "Users can view own mastery"
  on public.mastery for select
  using (auth.uid() = profile_id);
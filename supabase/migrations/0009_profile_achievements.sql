create table if not exists public.profile_achievements (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, achievement_id)
);

alter table public.profile_achievements enable row level security;

grant select on public.profile_achievements to authenticated;

create policy "Users can view own achievements"
  on public.profile_achievements for select
  using (auth.uid() = profile_id);
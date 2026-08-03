create table if not exists public.streaks_rewards (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reward_day integer not null check (reward_day in (3, 7, 30, 100)),
  awarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, reward_day)
);

alter table public.streaks_rewards enable row level security;

grant select on public.streaks_rewards to authenticated;

create policy "Users can view own streak rewards"
  on public.streaks_rewards for select
  using (auth.uid() = profile_id);
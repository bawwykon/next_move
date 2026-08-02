create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  age_range text check (age_range in ('under_18', '18_24', '25_34', '35_44', '45_54', '55_plus')),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  weekly_workouts integer check (weekly_workouts between 0 and 7),
  goal text check (goal in ('lose_fat', 'build_muscle', 'endurance', 'strength', 'general_fitness')),
  target_steps integer check (target_steps > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

alter table public.profiles enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.profiles to anon;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

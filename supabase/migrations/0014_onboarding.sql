create table if not exists public.onboarding (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  activity_level integer not null check (activity_level between 1 and 3),
  experience integer not null check (experience between 1 and 4),
  goals text[] not null default '{}' check (goals <@ array['build_a_habit', 'get_stronger', 'more_energy', 'feel_better', 'move_easier']::text[]),
  workout_time text check (workout_time in ('morning', 'afternoon', 'evening', 'any')),
  completed_at timestamptz
);

alter table public.onboarding enable row level security;

grant select, insert, update on public.onboarding to authenticated;
-- no grants to anon

create policy "Users can view own onboarding"
  on public.onboarding for select
  using (auth.uid() = profile_id);

create policy "Users can insert own onboarding"
  on public.onboarding for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own onboarding"
  on public.onboarding for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

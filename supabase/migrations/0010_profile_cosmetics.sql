create table if not exists public.profile_cosmetics (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  cosmetic_id uuid not null references public.cosmetics (id) on delete cascade,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, cosmetic_id)
);

alter table public.profile_cosmetics enable row level security;

grant select on public.profile_cosmetics to authenticated;

create policy "Users can view own cosmetics"
  on public.profile_cosmetics for select
  using (auth.uid() = profile_id);
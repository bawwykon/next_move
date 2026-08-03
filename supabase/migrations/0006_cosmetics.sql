create table if not exists public.cosmetics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  type text not null check (type in ('frame', 'title', 'background', 'portrait')),
  name text not null,
  unlock_rule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_cosmetics_updated_at on public.cosmetics;
create trigger set_cosmetics_updated_at
  before update on public.cosmetics
  for each row
  execute function public.handle_updated_at();

alter table public.cosmetics enable row level security;

grant select on public.cosmetics to anon, authenticated;
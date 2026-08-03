create table if not exists public.cosmetics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  kind text not null,
  rarity text,
  price_xp integer not null default 0 check (price_xp >= 0),
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
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
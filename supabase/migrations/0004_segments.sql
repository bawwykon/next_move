create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type text not null,
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_segments_updated_at on public.segments;
create trigger set_segments_updated_at
  before update on public.segments
  for each row
  execute function public.handle_updated_at();

alter table public.segments enable row level security;

grant select on public.segments to anon, authenticated;
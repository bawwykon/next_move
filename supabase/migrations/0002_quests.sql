create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text not null,
  difficulty text,
  type text,
  xp_reward integer not null default 0 check (xp_reward >= 0),
  duration_minutes integer check (duration_minutes > 0),
  target_value numeric check (target_value >= 0),
  requirement jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_quests_updated_at on public.quests;
create trigger set_quests_updated_at
  before update on public.quests
  for each row
  execute function public.handle_updated_at();

alter table public.quests enable row level security;

grant select on public.quests to anon, authenticated;

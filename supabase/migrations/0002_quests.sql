create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  difficulty text not null check (difficulty in ('easy', 'normal', 'hard', 'elite')),
  xp_reward integer not null check (xp_reward in (50, 100, 200, 400)),
  duration_sec integer not null check (duration_sec between 480 and 1200),
  categories text[] not null default '{}',
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
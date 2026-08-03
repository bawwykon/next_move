create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  hint text,
  category text not null check (category in ('beginner', 'progress', 'consistency', 'special')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_achievements_updated_at on public.achievements;
create trigger set_achievements_updated_at
  before update on public.achievements
  for each row
  execute function public.handle_updated_at();

alter table public.achievements enable row level security;

grant select on public.achievements to anon, authenticated;
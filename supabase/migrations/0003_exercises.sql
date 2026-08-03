create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text not null,
  muscle_group text,
  equipment text,
  instructions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_exercises_updated_at on public.exercises;
create trigger set_exercises_updated_at
  before update on public.exercises
  for each row
  execute function public.handle_updated_at();

alter table public.exercises enable row level security;

grant select on public.exercises to anon, authenticated;

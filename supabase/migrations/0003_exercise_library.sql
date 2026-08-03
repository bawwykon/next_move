create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  instruction text,
  safety_note text,
  categories text[] not null default '{}',
  beginner_variation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_exercise_library_updated_at on public.exercise_library;
create trigger set_exercise_library_updated_at
  before update on public.exercise_library
  for each row
  execute function public.handle_updated_at();

alter table public.exercise_library enable row level security;

grant select on public.exercise_library to anon, authenticated;
create table if not exists public.quest_segments (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests (id) on delete cascade,
  position integer not null check (position > 0),
  kind text not null check (kind in ('warmup', 'work', 'rest', 'cooldown')),
  exercise_id uuid references public.exercise_library (id),
  duration_sec integer not null check (duration_sec > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_quest_segments_updated_at on public.quest_segments;
create trigger set_quest_segments_updated_at
  before update on public.quest_segments
  for each row
  execute function public.handle_updated_at();

alter table public.quest_segments enable row level security;

grant select on public.quest_segments to anon, authenticated;
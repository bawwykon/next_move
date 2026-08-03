create table if not exists public.quest_completions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  quest_id uuid not null references public.quests (id) on delete cascade,
  idempotency_key uuid not null,
  started_at timestamptz,
  completed_at timestamptz,
  duration_sec integer check (duration_sec >= 0),
  xp_awarded integer check (xp_awarded >= 0),
  bonus_breakdown jsonb not null default '{}'::jsonb,
  mastered text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists quest_completions_profile_completed_at_idx
  on public.quest_completions (profile_id, completed_at desc);

create unique index if not exists quest_completions_profile_idempotency_key_idx
  on public.quest_completions (profile_id, idempotency_key);

create index if not exists quest_completions_profile_quest_completed_at_idx
  on public.quest_completions (profile_id, quest_id, completed_at);

alter table public.quest_completions enable row level security;

grant select on public.quest_completions to authenticated;

create policy "Users can view own quest completions"
  on public.quest_completions for select
  using (auth.uid() = profile_id);
alter table public.profiles
  add column if not exists display_name text not null default 'Adventurer';

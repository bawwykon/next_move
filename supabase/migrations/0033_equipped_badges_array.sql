-- BADGE-02 — multi-badge profile showcase (up to 3 equipped badges).
-- Migrates single equipped_badge to equipped_badges text[] array.

-- 1. Add the new array column.
alter table public.profiles
  add column if not exists equipped_badges text[] not null default '{}';

-- 2. Migrate existing single badge into the array.
update public.profiles
  set equipped_badges = case
    when equipped_badge is not null then array[equipped_badge]
    else '{}'
  end
  where equipped_badge is not null;

-- 3. Add a check constraint: max 3 items.
alter table public.profiles
  add constraint equipped_badges_max_3
  check (array_length(equipped_badges, 1) <= 3);

-- 4. Create an index for efficient array queries.
create index if not exists idx_profiles_equipped_badges
  on public.profiles using gin (equipped_badges);

-- 5. Keep the old column for backward compatibility during transition.
-- The app will read from equipped_badges; the old column is left in place
-- but no longer written to by the new equip logic.

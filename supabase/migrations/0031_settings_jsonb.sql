-- SET-01: local gameplay settings persisted in profiles.settings JSONB.
-- Client-writable JSONB for sound/haptics/exercise art toggles; server never
-- trusts it for progression (only cosmetic/UX). RLS already allows
-- update own profile; no new policy needed.
alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;

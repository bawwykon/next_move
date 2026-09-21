-- 0059_custom_avatar_storage.sql
-- CUSTOM-AVATAR — user-uploaded profile photos (Discord-style).
-- profiles.avatar_url holds the public storage URL (null = equipped RPG
-- portrait). Files live at avatars/{user_id}/avatar.jpg (single slot,
-- upsert overwrite). Client writes go through update-own RLS (avatar_url is
-- not a protect_progression column, so no guard change needed); storage
-- objects are user-scoped, publicly readable. Local-only until release.

-- 1. avatar_url column (client-writable, read-own).
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Public avatars bucket (5 MB, images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 3. Users manage only their own folder: avatars/{auth.uid()}/...
drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Public read (avatar renders for anyone who can see the profile).
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- 0061_delete_account.sql
-- PRIVACY/DSR (policy section 5): in-app account deletion. The user calls
-- delete_my_account() with their own session; SECURITY DEFINER deletes the
-- auth.users row, which cascades to public.profiles (0001) and every
-- per-profile table (FKs 0007..0060 are all on delete cascade).
--
-- Avatar files (0059 avatars bucket) are NOT touched here: storage blocks
-- direct DELETE on storage.objects ("use the Storage API instead"), so the
-- client removes avatars/{uid}/avatar.jpg via the Storage API before calling
-- this function (settings.tsx handleDeleteAccount).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

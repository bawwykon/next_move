-- ED-16: completion events carry the client-local day key (Ref 05 §tz).
-- Streak/day math uses this key, not server time (EC-3, EC-5).
-- No writer yet (the S5 complete_quest RPC populates it); nullable until then.
alter table public.quest_completions
  add column if not exists day_key text;

create index if not exists quest_completions_profile_day_key_idx
  on public.quest_completions (profile_id, day_key);

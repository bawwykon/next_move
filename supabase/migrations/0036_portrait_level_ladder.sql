-- 0036_portrait_level_ladder.sql
-- Title: Portraits to pure level ladder (remove phoenix quit-farm)
-- Reason: phoenix required 7-day quit (seed.sql:353+378) -> perverse incentive

-- Pure level unlocks for portraits
update public.cosmetics set unlock_rule='{"kind":"level","level":25}' where slug='portrait-phoenix';
update public.cosmetics set unlock_rule='{"kind":"level","level":45}' where slug='portrait-pathfinder';
update public.cosmetics set unlock_rule='{"kind":"level","level":65}' where slug='portrait-warden';
update public.cosmetics set unlock_rule='{"kind":"level","level":100}' where slug='portrait-master';

-- idempotent ON CONFLICT form:
insert into public.cosmetics (slug,type,name,unlock_rule) values
 ('portrait-phoenix','portrait','Phoenix Portrait','{"kind":"level","level":25}'),
 ('portrait-pathfinder','portrait','Pathfinder','{"kind":"level","level":45}'),
 ('portrait-warden','portrait','Warden','{"kind":"level","level":65}'),
 ('portrait-master','portrait','Master Portrait','{"kind":"level","level":100}')
on conflict (slug) do update set unlock_rule=excluded.unlock_rule;

-- Shorten long Emerald Vanguard names and make level visible
update public.cosmetics set name='Level 75 Emerald Frame' where slug='frame-level-75';
update public.cosmetics set name='Emerald Nameplate' where slug='nameplate-level-75';
-- Ensure frame/nameplate level names are consistent (already Level X Frame for 5/10/25/50/100, keep as is)
-- Ensure portrait names are in display order-friendly form (no rename needed, keep Classic/Phoenix etc.)

-- Ensure premium portrait exists for ordering (if missing, insert)
insert into public.cosmetics (slug,type,name,unlock_rule) values
 ('premium_portrait','portrait','Premium Portrait','{"kind":"purchase"}')
on conflict (slug) do nothing;

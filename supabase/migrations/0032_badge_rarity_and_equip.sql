-- BADGE-01 — rarity borders + premium badge + profile equip slot.
-- Rarity is purely visual (Common/Rare/Epic/Legendary), not a progression gate.
alter table public.achievements
  add column if not exists rarity text not null default 'Common'
    check (rarity in ('Common','Rare','Epic','Legendary'));

-- Backfill rarity per design (accomplishment-only, no grind):
-- Common: first steps (beginner)
-- Rare: early milestones
-- Epic: mid milestones
-- Legendary: summit + premium
update public.achievements set rarity = 'Common' where slug in ('first-quest','first-level','first-week');
update public.achievements set rarity = 'Rare' where slug in ('streak-7','workouts-50');
update public.achievements set rarity = 'Epic' where slug in ('streak-30','workouts-100','early-bird','night-owl');
update public.achievements set rarity = 'Legendary' where slug in ('phoenix','streak-100','workouts-250','master-adventurer');

-- Premium badge — one static Legendary badge, granted at purchase (no seasons).
insert into public.achievements (slug, title, description, hint, category, rarity, unlock_rule) values
  ('founders-emblem', 'Founder''s Emblem', 'Awarded to founding supporters.', 'Reserved for founders.', 'special', 'Legendary', '{"kind":"purchase","sku":"founders_emblem"}')
on conflict (slug) do update set rarity = 'Legendary', title = 'Founder''s Emblem';

-- Profile equip slot: one badge shown next to name frame (nullable).
alter table public.profiles
  add column if not exists equipped_badge text null references public.achievements(slug) on delete set null;

-- Allow client to update equipped_badge (same RLS update-own policy already allows it).

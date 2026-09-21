-- 0057_cosmetic_name_consistency.sql
-- LOADOUT-03 — one convention per ladder: the premium row shares the
-- "Premium X" name (matching Premium Portrait), and level portraits carry
-- the "<name> Portrait" form (matching Phoenix/Master Portrait).

UPDATE public.cosmetics SET name = 'Premium Frame' WHERE slug = 'premium_frame';
UPDATE public.cosmetics SET name = 'Premium Nameplate' WHERE slug = 'premium-nameplate';
UPDATE public.cosmetics SET name = 'Pathfinder Portrait' WHERE slug = 'portrait-pathfinder';
UPDATE public.cosmetics SET name = 'Warden Portrait' WHERE slug = 'portrait-warden';

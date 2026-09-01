-- 0034_nameplates_cosmetics.sql
-- LOADOUT-01: Add equipped_nameplate column and seed nameplate cosmetics.

-- 1. Allow nameplate type
ALTER TABLE public.cosmetics DROP CONSTRAINT IF EXISTS cosmetics_type_check;
ALTER TABLE public.cosmetics ADD CONSTRAINT cosmetics_type_check CHECK (type IN ('frame','title','background','portrait','nameplate'));

-- 1b. Add the column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_nameplate text NOT NULL DEFAULT 'nameplate-default';

-- 2. Seed nameplate cosmetics
INSERT INTO public.cosmetics (slug, name, type, unlock_rule) VALUES
  ('nameplate-default',  'Default Nameplate',   'nameplate', '{"kind":"level","level":1}'),
  ('nameplate-level-05', 'Bronze Nameplate',    'nameplate', '{"kind":"level","level":5}'),
  ('nameplate-level-10', 'Silver Nameplate',    'nameplate', '{"kind":"level","level":10}'),
  ('nameplate-level-25', 'Gold Nameplate',      'nameplate', '{"kind":"level","level":25}'),
  ('nameplate-level-50', 'Platinum Nameplate',  'nameplate', '{"kind":"level","level":50}'),
  ('nameplate-level-100','Legendary Nameplate', 'nameplate', '{"kind":"level","level":100}'),
  ('premium-nameplate',  'Founder''s Nameplate', 'nameplate', '{"kind":"purchase"}')
ON CONFLICT (slug) DO NOTHING;

-- 3. Auto-grant nameplate-default to all profiles via profile_cosmetics
INSERT INTO public.profile_cosmetics (profile_id, cosmetic_id)
SELECT p.id, c.id
FROM public.profiles p
CROSS JOIN public.cosmetics c
WHERE c.slug = 'nameplate-default'
  AND NOT EXISTS (
    SELECT 1 FROM public.profile_cosmetics pc
    WHERE pc.profile_id = p.id AND pc.cosmetic_id = c.id
  );

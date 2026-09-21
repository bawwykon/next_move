-- 0056_premium_frame.sql
-- LOADOUT-02 — the premium frame was fully wired client-side (asset,
-- hole measurements, purchase meta, sort position) but never seeded, so the
-- picker had no row. Also normalizes the Lv-75 frame name to the ladder
-- convention (nameplates keep their metal names).

INSERT INTO public.cosmetics (slug, name, type, unlock_rule) VALUES
  ('premium_frame', 'Premium Frame', 'frame', '{"kind":"purchase"}')
ON CONFLICT (slug) DO NOTHING;

UPDATE public.cosmetics SET name = 'Level 75 Frame' WHERE slug = 'frame-level-75';

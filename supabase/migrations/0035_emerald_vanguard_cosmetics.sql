-- 0035_emerald_vanguard_cosmetics.sql
-- AST-02 — Emerald Vanguard set (frame 75, nameplate 75) + portraits 60/80

INSERT INTO public.cosmetics (slug, name, type, unlock_rule) VALUES
  ('frame-level-75',       'Emerald Vanguard Frame',     'frame',     '{"kind":"level","level":75}'),
  ('nameplate-level-75',   'Emerald Vanguard Nameplate', 'nameplate', '{"kind":"level","level":75}'),
  ('portrait-pathfinder',  'Pathfinder',                 'portrait',  '{"kind":"level","level":60}'),
  ('portrait-warden',      'Warden',                     'portrait',  '{"kind":"level","level":80}'),
  ('title-level-75',       'Vanguard',                   'title',     '{"kind":"level","level":75}')
ON CONFLICT (slug) DO NOTHING;

-- 0058_premium_emblem.sql
-- LOADOUT-04 — the Founder's Emblem joins the "Premium X" convention
-- (matching Premium Portrait/Frame/Nameplate). Slug and purchase SKU are
-- untouched: unlock grants reference them, only display copy changes.

UPDATE public.achievements
SET title = 'Premium Emblem',
    description = 'Awarded to premium supporters.',
    hint = 'Reserved for premium supporters.'
WHERE slug = 'founders-emblem';

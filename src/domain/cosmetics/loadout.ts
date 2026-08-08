/**
 * S8-02 — cosmetic loadout domain (FR-COS-1/2). Pure: slot ↔ column mapping,
 * catalogue grouping with ownership flags, equip/un-equip validation and
 * display-name resolution. Ownership is decided server-side (profile_cosmetics
 * rows); the client only ever sees ids/slugs/names — never unlock rules.
 */

export type CosmeticSlot = 'frame' | 'title' | 'background' | 'portrait';

export const COSMETIC_SLOTS: readonly CosmeticSlot[] = ['frame', 'title', 'background', 'portrait'];

/** Slot → profiles table column (M0019 `equipped_*`). */
export const SLOT_COLUMN: Record<CosmeticSlot, string> = {
  frame: 'equipped_frame',
  title: 'equipped_title',
  background: 'equipped_background',
  portrait: 'equipped_portrait',
};

/** Slot spelling → column name; unknown spellings yield null for the caller to reject. */
export function slotColumn(slot: string): string | null {
  return SLOT_COLUMN[slot as CosmeticSlot] ?? null;
}

/** The seeded default item per slot, where one exists (display fallback). */
export const DEFAULT_SLOT_SLUGS: Partial<Record<CosmeticSlot, string>> = {
  frame: 'frame-default',
  portrait: 'portrait-default',
};

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  kind: string;
}

export interface OwnedCatalogItem extends CatalogItem {
  owned: boolean;
}

/** Owned-slug set from the profile's `profile_cosmetics` rows (RLS read-own). */
export function ownedBySlug(rows: readonly { slug: string }[]): Set<string> {
  return new Set(rows.map((row) => row.slug));
}

/**
 * The picker rows grouped per slot, in catalogue order, with the ownership
 * flag. Only items whose kind matches the slot appear in that slot's rows.
 */
export function catalogBySlot(
  catalog: readonly CatalogItem[],
  owned: ReadonlySet<string>,
): Record<CosmeticSlot, OwnedCatalogItem[]> {
  const grouped: Record<CosmeticSlot, OwnedCatalogItem[]> = {
    frame: [],
    title: [],
    background: [],
    portrait: [],
  };
  for (const item of catalog) {
    const slot = item.kind as CosmeticSlot;
    if (slot in grouped) {
      grouped[slot].push({ ...item, owned: owned.has(item.slug) });
    }
  }
  return grouped;
}

export type EquipVerdict =
  { ok: true } | { ok: false; reason: 'UNKNOWN_SLOT' | 'UNKNOWN_ITEM' | 'NOT_OWNED' };

/**
 * Equip validation — the only gate before anything is persisted. A null item
 * unequips (always allowed; the default loadout is never locked away). An item
 * id must exist AND belong to the user and match the slot; anything else is a
 * domain error and must never reach the database (the picker shows it as a
 * "?" row and cannot submit it, but this stays the backstop).
 */
export function validateEquip(
  slot: CosmeticSlot,
  itemId: string | null,
  owned: ReadonlySet<string>,
  catalog: readonly CatalogItem[],
): EquipVerdict {
  if (itemId === null) {
    return { ok: true };
  }
  const item = catalog.find((candidate) => candidate.id === itemId);
  if (!item) {
    return { ok: false, reason: 'UNKNOWN_ITEM' };
  }
  if (item.kind !== slot) {
    return { ok: false, reason: 'UNKNOWN_ITEM' };
  }
  if (!owned.has(item.slug)) {
    return { ok: false, reason: 'NOT_OWNED' };
  }
  return { ok: true };
}

export interface EquippedSlot {
  slot: CosmeticSlot;
  /** Name of the currently equipped item (catalogue), or null when unset. */
  equippedName: string | null;
  /** Name of the slot's seeded default (frame/portrait), or null otherwise. */
  defaultName: string | null;
  /** True when the slot is unequipped (the default look is active). */
  usingDefault: boolean;
}

/**
 * Per-slot display resolution: equipped id → catalogue name; an unset slot
 * falls back to the seeded default item's name when one exists (FR-PROF-2).
 * Only id/slug/name are needed here (no kind).
 */
export function resolveEquipped(
  equipped: {
    frame: string | null;
    title: string | null;
    background: string | null;
    portrait: string | null;
  },
  catalog: readonly { id: string; slug: string; name: string }[],
): Record<CosmeticSlot, EquippedSlot> {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const bySlug = new Map(catalog.map((item) => [item.slug, item.name]));
  const resolveOne = (slot: CosmeticSlot, id: string | null): EquippedSlot => {
    const item = id ? (byId.get(id) ?? null) : null;
    const defaultSlug = DEFAULT_SLOT_SLUGS[slot];
    const defaultName = defaultSlug ? (bySlug.get(defaultSlug) ?? null) : null;
    // "using the default" means the slot is truly unset — a set-but-unresolvable
    // id (catalogue drift) is not the default look, it's a broken reference.
    const usingDefault = id === null;
    return {
      slot,
      equippedName: item?.name ?? null,
      defaultName,
      usingDefault,
    };
  };
  return {
    frame: resolveOne('frame', equipped.frame),
    title: resolveOne('title', equipped.title),
    background: resolveOne('background', equipped.background),
    portrait: resolveOne('portrait', equipped.portrait),
  };
}

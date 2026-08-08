/**
 * S8-02 — cosmetic loadout domain pins: slot↔column mapping, ownership
 * grouping, equip validation gates, and display resolution with defaults.
 */
import {
  catalogBySlot,
  DEFAULT_SLOT_SLUGS,
  ownedBySlug,
  resolveEquipped,
  SLOT_COLUMN,
  slotColumn,
  validateEquip,
  type CatalogItem,
} from '@/domain/cosmetics/loadout';

const CATALOG: CatalogItem[] = [
  { id: 'f1', slug: 'frame-default', name: 'Classic Frame', kind: 'frame' },
  { id: 'f2', slug: 'frame-level-05', name: 'Level 5 Frame', kind: 'frame' },
  { id: 't1', slug: 'title-adventurer', name: 'Adventurer', kind: 'title' },
  { id: 'b1', slug: 'bg-chapter-02', name: 'Chapter 2 Scene', kind: 'background' },
  { id: 'p1', slug: 'portrait-default', name: 'Classic Portrait', kind: 'portrait' },
  { id: 'x1', slug: 'mystery-item', name: 'Mystery', kind: 'weird-kind' },
];

describe('slotColumn', () => {
  it('maps the four slots to their profiles columns exactly', () => {
    expect(slotColumn('frame')).toBe('equipped_frame');
    expect(slotColumn('title')).toBe('equipped_title');
    expect(slotColumn('background')).toBe('equipped_background');
    expect(slotColumn('portrait')).toBe('equipped_portrait');
  });

  it('rejects unknown spellings (labels are not slots)', () => {
    expect(slotColumn('Frame')).toBeNull();
    expect(slotColumn('bogus')).toBeNull();
    expect(slotColumn('')).toBeNull();
  });

  it('SLOT_COLUMN covers exactly the four slots', () => {
    expect(Object.keys(SLOT_COLUMN).sort()).toEqual(['background', 'frame', 'portrait', 'title']);
    expect(Object.keys(DEFAULT_SLOT_SLUGS).sort()).toEqual(['frame', 'portrait']);
  });
});

describe('ownedBySlug', () => {
  it('builds a de-duplicated set from profile_cosmetics rows', () => {
    const owned = ownedBySlug([
      { slug: 'frame-default' },
      { slug: 'title-adventurer' },
      { slug: 'frame-default' },
    ]);
    expect(owned.has('frame-default')).toBe(true);
    expect(owned.has('title-adventurer')).toBe(true);
    expect(owned.size).toBe(2);
  });
});

describe('catalogBySlot', () => {
  it('groups every item under its kind and flags ownership', () => {
    const grouped = catalogBySlot(CATALOG, new Set(['frame-default']));
    expect(grouped.frame.map((item) => item.slug)).toEqual(['frame-default', 'frame-level-05']);
    expect(grouped.title.map((item) => item.slug)).toEqual(['title-adventurer']);
    expect(grouped.background.map((item) => item.slug)).toEqual(['bg-chapter-02']);
    expect(grouped.portrait.map((item) => item.slug)).toEqual(['portrait-default']);
    expect(grouped.frame[0]!.owned).toBe(true);
    expect(grouped.frame[1]!.owned).toBe(false);
  });

  it('drops items with unknown kinds (never surface)', () => {
    const grouped = catalogBySlot(CATALOG, new Set());
    const all = [...grouped.frame, ...grouped.title, ...grouped.background, ...grouped.portrait];
    expect(all.some((item) => item.slug === 'mystery-item')).toBe(false);
  });
});

describe('validateEquip', () => {
  const owned = new Set(['frame-default', 'title-adventurer']);

  it('unequip (null) is always allowed', () => {
    expect(validateEquip('frame', null, owned, CATALOG)).toEqual({ ok: true });
    expect(validateEquip('title', null, owned, CATALOG)).toEqual({ ok: true });
  });

  it('allows equipping an owned item of the right kind', () => {
    expect(validateEquip('frame', 'f1', owned, CATALOG)).toEqual({ ok: true });
  });

  it('rejects items the user does not own', () => {
    expect(validateEquip('frame', 'f2', owned, CATALOG)).toEqual({
      ok: false,
      reason: 'NOT_OWNED',
    });
  });

  it('rejects unknown ids and kind mismatches', () => {
    expect(validateEquip('frame', 'ghost-id', owned, CATALOG)).toEqual({
      ok: false,
      reason: 'UNKNOWN_ITEM',
    });
    // a title item handed to the frame slot is still a foreign item
    expect(validateEquip('frame', 't1', owned, CATALOG)).toEqual({
      ok: false,
      reason: 'UNKNOWN_ITEM',
    });
  });
});

describe('resolveEquipped', () => {
  it('resolves equipped ids and falls back to seeded defaults', () => {
    const resolved = resolveEquipped(
      { frame: 'f2', title: null, background: null, portrait: 'p1' },
      CATALOG,
    );
    expect(resolved.frame.equippedName).toBe('Level 5 Frame');
    expect(resolved.frame.defaultName).toBe('Classic Frame');
    expect(resolved.frame.usingDefault).toBe(false);
    expect(resolved.title.equippedName).toBeNull();
    expect(resolved.title.defaultName).toBeNull();
    expect(resolved.title.usingDefault).toBe(true);
    expect(resolved.background.defaultName).toBeNull();
    expect(resolved.portrait.equippedName).toBe('Classic Portrait');
    expect(resolved.portrait.defaultName).toBe('Classic Portrait');
    expect(resolved.portrait.usingDefault).toBe(false);
  });

  it('unknown equipped ids are broken references, not the default look', () => {
    const resolved = resolveEquipped(
      { frame: 'ghost', title: null, background: null, portrait: null },
      CATALOG,
    );
    expect(resolved.frame.equippedName).toBeNull();
    expect(resolved.frame.defaultName).toBe('Classic Frame');
    expect(resolved.frame.usingDefault).toBe(false);
  });
});

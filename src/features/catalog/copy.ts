/**
 * CATALOG-01 — bundled quest/chapter copy lookups (Phase 4).
 *
 * The server stays the source of truth for numbers (XP, durations, thresholds)
 * and for user content (custom names); display copy for the shipped catalogue
 * lives in the locale tables (`catalog.quests.*`, `catalog.chapters.*`) so the
 * app works offline. Lookups take the DB value as `defaultValue`: unknown
 * slugs (custom workouts, future content) pass straight through in English.
 */
import type { TFunction } from 'i18next';

/** Localized quest title by slug, falling back to the DB title. */
export function questTitle(
  slug: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string | null {
  if (!slug) {
    return fallback;
  }
  const out = t(`catalog.quests.${slug}.title`, { defaultValue: fallback ?? '' });
  return out === '' ? null : out;
}

/** Localized quest description by slug, falling back to the DB description. */
export function questDescription(
  slug: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string | null {
  if (!slug) {
    return fallback;
  }
  const out = t(`catalog.quests.${slug}.description`, { defaultValue: fallback ?? '' });
  return out === '' ? null : out;
}

/** Localized chapter name by id, falling back to the reference name. */
export function chapterName(id: number, fallback: string, t: TFunction): string {
  return t(`catalog.chapters.${id}.name`, { defaultValue: fallback });
}

/** Localized chapter flavor by id, falling back to the reference flavor. */
export function chapterFlavor(id: number, fallback: string, t: TFunction): string {
  return t(`catalog.chapters.${id}.flavor`, { defaultValue: fallback });
}

function catalogString(key: string, fallback: string | null, t: TFunction): string | null {
  if (fallback == null) {
    // Nothing sensible to show and no table entry expected — stay quiet
    // instead of echoing the key path. Known slugs always ship a fallback.
    const probe = t(key, { defaultValue: '' });
    return probe === '' ? null : probe;
  }
  const out = t(key, { defaultValue: fallback });
  return out === '' ? fallback : out;
}

/** Localized exercise name by slug, falling back to the DB name. */
export function exerciseName(
  slug: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string | null {
  if (!slug) {
    return fallback;
  }
  return catalogString(`catalog.exercises.${slug}.name`, fallback, t);
}

/** Localized exercise how-to by slug, falling back to the DB instruction. */
export function exerciseInstruction(
  slug: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string | null {
  if (!slug) {
    return fallback;
  }
  return catalogString(`catalog.exercises.${slug}.instruction`, fallback, t);
}

/** Localized exercise safety note by slug, falling back to the DB note. */
export function exerciseSafety(
  slug: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string | null {
  if (!slug) {
    return fallback;
  }
  return catalogString(`catalog.exercises.${slug}.safety`, fallback, t);
}

/** Localized achievement title by slug, falling back to the DB title. */
export function achievementTitle(
  slug: string | null | undefined,
  fallback: string,
  t: TFunction,
): string {
  if (!slug) {
    return fallback;
  }
  return catalogString(`catalog.achievements.${slug}.title`, fallback, t) ?? fallback;
}

/** Localized achievement description by slug, falling back to the DB text. */
export function achievementDescription(
  slug: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string | null {
  if (!slug) {
    return fallback;
  }
  return catalogString(`catalog.achievements.${slug}.description`, fallback, t);
}

/** Localized achievement vague hint by slug, falling back to the DB hint. */
export function achievementHint(
  slug: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string | null {
  if (!slug) {
    return fallback;
  }
  return catalogString(`catalog.achievements.${slug}.hint`, fallback, t);
}

const RARITY_KEYS: Record<string, string> = {
  Common: 'achievements.rarity.common',
  Rare: 'achievements.rarity.rare',
  Epic: 'achievements.rarity.epic',
  Legendary: 'achievements.rarity.legendary',
};

/** Localized rarity label; unknown values pass through untouched. */
export function achievementRarity(rarity: string, t: TFunction): string {
  const key = RARITY_KEYS[rarity];
  return key ? t(key) : rarity;
}

const CATEGORY_KEYS: Record<string, string> = {
  beginner: 'achievements.category.beginner',
  progress: 'achievements.category.progress',
  consistency: 'achievements.category.consistency',
  special: 'achievements.category.special',
  mastery: 'achievements.category.mastery',
};

/** Localized achievement category; unknown values pass through untouched. */
export function achievementCategory(category: string, t: TFunction): string {
  const key = CATEGORY_KEYS[category];
  return key ? t(key) : category;
}

/** Localized cosmetic name by slug, falling back to the DB name. */
export function cosmeticName(
  slug: string | null | undefined,
  fallback: string | null,
  t: TFunction,
): string | null {
  if (!slug) {
    return fallback;
  }
  return catalogString(`catalog.cosmetics.${slug}.name`, fallback, t);
}

const COSMETIC_TYPE_KEYS: Record<string, string> = {
  frame: 'catalog.cosmeticTypes.frame',
  nameplate: 'catalog.cosmeticTypes.nameplate',
  portrait: 'catalog.cosmeticTypes.portrait',
  title: 'catalog.cosmeticTypes.title',
  background: 'catalog.cosmeticTypes.background',
};

/** Localized cosmetic type; unknown values pass through untouched. */
export function cosmeticType(type: string, t: TFunction): string {
  const key = COSMETIC_TYPE_KEYS[type];
  return key ? t(key) : type;
}

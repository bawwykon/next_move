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

/**
 * S7-02 — achievement catalogue merging (FR-ACH-1/4/5). Pure and read-only:
 * inputs are never mutated; deterministic ordering (unlocked first, then the
 * catalogue order within each group, which is the DB's slug order). The
 * machine-readable `unlock_rule` never exists in client memory (the repos
 * exclude it at the SQL level and strip it in mapping) — the locked row
 * presents the vague hint only (FR-ACH-4).
 */
export type AchievementCategory = 'beginner' | 'progress' | 'consistency' | 'special';

export interface AchievementCatalogRow {
  slug: string;
  title: string;
  description: string | null;
  hint: string | null;
  category: AchievementCategory;
}

export interface AchievementUnlock {
  slug: string;
  /** ISO timestamp from the server (profile_achievements.unlocked_at). */
  unlockedAt: string;
}

export type AchievementState = 'unlocked' | 'locked';

export interface AchievementRow {
  slug: string;
  title: string;
  description: string | null;
  category: AchievementCategory;
  state: AchievementState;
  /** Only on locked rows — the vague hint, never the trigger. */
  hint?: string | null;
  /** Only on unlocked rows. */
  unlockedAt?: string;
}

export const LOCKED_EMBLEM = '?';
const FALLBACK_HINT = 'Some things reveal themselves in time.';

export function lockedCopy(hint: string | null): { emblem: typeof LOCKED_EMBLEM; hint: string } {
  return { emblem: LOCKED_EMBLEM, hint: hint ?? FALLBACK_HINT };
}

/**
 * Merge the server catalogue with the unlocked slugs into the display set.
 * - unlocked rows keep `unlockedAt` (no hint);
 * - locked rows keep the vague hint (no unlock date);
 * - order: every unlocked row first, then locked, each group stable in
 *   catalogue order; unrecognised unlock slugs are ignored.
 */
export function mergeCatalogWithUnlocks(
  catalog: AchievementCatalogRow[],
  unlocks: AchievementUnlock[],
): AchievementRow[] {
  const unlockedSlugs = new Set(unlocks.map((unlock) => unlock.slug));
  const unlocked: AchievementRow[] = [];
  const locked: AchievementRow[] = [];

  for (const row of catalog) {
    const base = {
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
    };
    if (unlockedSlugs.has(row.slug)) {
      const unlockedAt = unlocks.find((unlock) => unlock.slug === row.slug)?.unlockedAt;
      unlocked.push({ ...base, state: 'unlocked', unlockedAt });
    } else {
      locked.push({ ...base, state: 'locked', hint: row.hint });
    }
  }

  return [...unlocked, ...locked];
}

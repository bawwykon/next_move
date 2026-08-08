import { supabase } from '@/data/supabase';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';
import type { AchievementCatalogRow, AchievementUnlock } from '@/domain/achievements/merge';

/**
 * Defence in depth (ED-21/FR-ACH-4): the machine-readable unlock rule must
 * never reach the client. It is excluded from the SQL projection AND the
 * allowed-field strip below, so even a future schema change that returns extra
 * columns cannot smuggle it into the typed row.
 */
const CATALOG_FIELDS = ['slug', 'title', 'description', 'hint', 'category'] as const;
type CatalogField = (typeof CATALOG_FIELDS)[number];

const strip = (row: Record<string, unknown>): Pick<AchievementCatalogRow, CatalogField> => {
  const picks: Record<string, unknown> = {};
  for (const field of CATALOG_FIELDS) {
    if (field in row) {
      picks[field] = row[field];
    }
  }
  return picks as Pick<AchievementCatalogRow, CatalogField>;
};

export async function fetchAchievementCatalog(): Promise<RepoResult<AchievementCatalogRow[]>> {
  const { data, error } = await supabase
    .from('achievements')
    .select('slug, title, description, hint, category')
    .order('slug');

  if (error) {
    return fail(`Could not load achievements: ${error.message}`);
  }

  return ok(
    (data ?? []).map((row) => strip(row as Record<string, unknown>) as AchievementCatalogRow),
  );
}

/**
 * Unlocked rows for the signed-in user (RLS: select-own). `unlocked_at`
 * ascending so the timeline renders oldest-of-the-run first. A foreign
 * user's id simply yields no rows (policy-filtered, never an error).
 */
export async function fetchProfileAchievements(
  profileId: string,
): Promise<RepoResult<AchievementUnlock[]>> {
  const { data, error } = await supabase
    .from('profile_achievements')
    .select('unlocked_at, achievements(slug)')
    .eq('profile_id', profileId)
    .order('unlocked_at', { ascending: true });

  if (error) {
    return fail(`Could not load unlocked achievements: ${error.message}`);
  }

  return ok(
    (data ?? []).map((row) => ({
      slug: row.achievements?.slug ?? '',
      unlockedAt: row.unlocked_at as string,
    })),
  );
}

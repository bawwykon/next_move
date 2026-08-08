import { supabase } from '@/data/supabase';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

/**
 * S8-01 — cosmetic catalogue (content-RLS, read-only). Defence in depth
 * (ED-21/FR-ACH-4 pattern): the projection carries ONLY what the profile page
 * needs to resolve equipped display names — id (maps `profiles.equipped_*`
 * uuids), slug, name. `unlock_rule` is excluded at SQL level AND stripped
 * below, so a future schema change can never smuggle it into the typed row.
 */
const CATALOG_FIELDS = ['id', 'slug', 'name'] as const;
type CatalogField = (typeof CATALOG_FIELDS)[number];

export interface CosmeticRow {
  id: string;
  slug: string;
  name: string;
}

const strip = (row: Record<string, unknown>): Pick<CosmeticRow, CatalogField> => {
  const picks: Record<string, unknown> = {};
  for (const field of CATALOG_FIELDS) {
    if (field in row) {
      picks[field] = row[field];
    }
  }
  return picks as Pick<CosmeticRow, CatalogField>;
};

/**
 * The full 18-item catalogue (6 frames, 6 titles, 3 backgrounds, 3 portraits),
 * ordered by slug for stable rendering. Content table, so this is the same for
 * every user; the loader stays policy-driven rather than role-driven.
 */
export async function fetchCosmeticCatalog(): Promise<RepoResult<CosmeticRow[]>> {
  const { data, error } = await supabase.from('cosmetics').select('id, slug, name').order('slug');

  if (error) {
    return fail(`Could not load cosmetics: ${error.message}`);
  }

  return ok((data ?? []).map((row) => strip(row as Record<string, unknown>) as CosmeticRow));
}

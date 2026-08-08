import { supabase } from '@/data/supabase';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

/**
 * S8-02 — cosmetic catalogue (content-RLS, read-only). Defence in depth
 * (ED-21 pattern, FR-COS-2): the projection carries ONLY what the picker
 * needs — id, slug, name, kind — never `unlock_rule` (excluded at SQL level
 * AND stripped below). Ownership is a separate server-side fact
 * (`profile_cosmetics`), never derived from rules client-side. The database
 * column is `type`; the row exposes it as `kind` (the API contract name).
 */
const CATALOG_FIELDS = ['id', 'slug', 'name', 'kind'] as const;
type CatalogField = (typeof CATALOG_FIELDS)[number];

export interface CosmeticRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
}

const strip = (row: Record<string, unknown>): Pick<CosmeticRow, CatalogField> => {
  const picks: Record<string, unknown> = {};
  for (const field of CATALOG_FIELDS) {
    if (field === 'kind' && 'type' in row) {
      picks.kind = row.type;
    } else if (field in row) {
      picks[field] = row[field];
    }
  }
  return picks as Pick<CosmeticRow, CatalogField>;
};

/**
 * The full 18-item catalogue (6 frames, 6 titles, 3 backgrounds, 3 portraits),
 * ordered by slug for stable rendering. Same content rows for every user.
 */
export async function fetchCosmeticCatalog(): Promise<RepoResult<CosmeticRow[]>> {
  const { data, error } = await supabase
    .from('cosmetics')
    .select('id, slug, name, type')
    .order('slug');

  if (error) {
    return fail(`Could not load cosmetics: ${error.message}`);
  }

  return ok((data ?? []).map((row) => strip(row as Record<string, unknown>) as CosmeticRow));
}

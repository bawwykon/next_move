import { supabase } from '@/data/supabase';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

export interface ProfileCosmeticRow {
  cosmeticId: string;
  slug: string;
  unlockedAt: string;
}

/**
 * S8-02 — the user's owned cosmetics (FR-COS-1): every row of the user's
 * `profile_cosmetics` joined to its catalogue slug. RLS select-own; a foreign
 * id simply yields no rows. Ownership is decided server-side (the RPC grants
 * rows when unlock rules fire) — this read only surfaces the verdict, and
 * unlock rules never appear in the projection (ED-21 pattern).
 */
export async function fetchProfileCosmetics(
  profileId: string,
): Promise<RepoResult<ProfileCosmeticRow[]>> {
  const { data, error } = await supabase
    .from('profile_cosmetics')
    .select('cosmetic_id, unlocked_at, cosmetics(slug)')
    .eq('profile_id', profileId)
    .order('unlocked_at', { ascending: true });

  if (error) {
    return fail(`Could not load owned cosmetics: ${error.message}`);
  }

  return ok(
    (data ?? []).map((row) => ({
      cosmeticId: row.cosmetic_id,
      slug: row.cosmetics?.slug ?? '',
      unlockedAt: row.unlocked_at as string,
    })),
  );
}

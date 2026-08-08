import { supabase } from '@/data/supabase';
import type { QuestCategory } from '@/domain/recommendation/types';
import { slotColumn } from '@/domain/cosmetics/loadout';
import { fetchProfileCosmetics } from '@/data/repositories/profileCosmetics';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

const RECENT_WINDOW_DAYS = 30;

export interface CharacterProfile {
  id: string;
  displayName: string | null;
  onboarded: boolean;
  /**
   * S7-01 — server-authoritative journey progress (M0019, `journey_quests`).
   * Total quests completed, permanent, never decreases (FR-JOURNEY-3).
   */
  journeyQuestCount: number;
  /** S7-01 — server-authoritative chapter position, 1-based (M0019). */
  currentChapter: number;
  /**
   * S8-01 — server-authoritative progression (M0019, written only by
   * `complete_quest`): level/total XP/streaks/equipped loadout are read
   * verbatim from the profile row, never recomputed client-side (FR-XP-7).
   */
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDay: string | null;
  equipped: {
    frame: string | null;
    title: string | null;
    background: string | null;
    portrait: string | null;
  };
}

export interface CompletionRow {
  questId: string;
  completedAt: string;
  dayKey: string | null;
  xpAwarded: number | null;
}

export interface MasteryRow {
  track: QuestCategory;
  points: number;
}

export async function fetchProfile(profileId: string): Promise<RepoResult<CharacterProfile>> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, display_name, onboarded, journey_quests, current_chapter, total_xp, level, current_streak, longest_streak, last_completed_day, equipped_frame, equipped_title, equipped_background, equipped_portrait',
    )
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    return fail(`Could not load profile: ${error.message}`);
  }
  if (!data) {
    return fail('Profile not found.');
  }
  return ok({
    id: data.id,
    displayName: data.display_name,
    onboarded: data.onboarded,
    journeyQuestCount: data.journey_quests,
    currentChapter: data.current_chapter,
    totalXp: data.total_xp,
    level: data.level,
    currentStreak: data.current_streak,
    longestStreak: data.longest_streak,
    lastCompletedDay: data.last_completed_day,
    equipped: {
      frame: data.equipped_frame,
      title: data.equipped_title,
      background: data.equipped_background,
      portrait: data.equipped_portrait,
    },
  });
}

/**
 * Last ~30 days of completions for the signed-in user (RLS select-own).
 */
export async function fetchRecentCompletions(
  profileId: string,
): Promise<RepoResult<CompletionRow[]>> {
  const cutoff = new Date(Date.now() - RECENT_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('quest_completions')
    .select('quest_id, completed_at, day_key, xp_awarded')
    .eq('profile_id', profileId)
    .not('completed_at', 'is', null)
    .gte('completed_at', cutoff)
    .order('completed_at', { ascending: false })
    .limit(200);

  if (error) {
    return fail(`Could not load completions: ${error.message}`);
  }

  return ok(
    (data ?? []).map((row) => ({
      questId: row.quest_id,
      completedAt: row.completed_at as string,
      dayKey: row.day_key,
      xpAwarded: row.xp_awarded,
    })),
  );
}

export async function fetchMastery(profileId: string): Promise<RepoResult<MasteryRow[]>> {
  const { data, error } = await supabase
    .from('mastery')
    .select('track, points')
    .eq('profile_id', profileId)
    .order('track');

  if (error) {
    return fail(`Could not load mastery: ${error.message}`);
  }

  return ok(
    (data ?? []).map((row) => ({
      track: row.track as QuestCategory,
      points: row.points,
    })),
  );
}

/**
 * S8-02 — equip/unequip a cosmetic on the profile row (FR-COS-1/2). This is
 * the first client-writable path beside the completion queue: it writes ONLY
 * the `equipped_*` column for the slot — columns the `protect_progression`
 * guard deliberately leaves client-writable — through the same update-own RLS
 * as everything else. `itemId` null unequips (back to the default look).
 *
 * Defence in depth: the helper re-validates ownership against the user's own
 * `profile_cosmetics` rows (RLS read-own) before issuing the UPDATE, so an
 * unowned item can never be persisted through this path even if the picker
 * were bypassed. (The database itself carries no ownership check on
 * `equipped_*` — adding one would need a migration, out of S8-02 scope; the
 * gate lives in the one write path the app uses.)
 */
export async function equipCosmetic(
  profileId: string,
  slot: string,
  itemId: string | null,
): Promise<RepoResult<null>> {
  const column = slotColumn(slot);
  if (!column) {
    return fail(`Unknown cosmetic slot: ${slot}`);
  }
  if (itemId !== null) {
    const ownedResult = await fetchProfileCosmetics(profileId);
    if (ownedResult.error) {
      return fail(`Could not verify ownership: ${ownedResult.error}`);
    }
    const ownedSlugs = new Set((ownedResult.data ?? []).map((row) => row.slug));
    const item = await catalogItemById(itemId);
    if (item.error || !item.data) {
      return fail(`Unknown cosmetic item: ${itemId}`);
    }
    if (!ownedSlugs.has(item.data.slug)) {
      return fail(`Cosmetic is not owned: ${item.data.slug}`);
    }
  }
  const patch =
    column === 'equipped_frame'
      ? { equipped_frame: itemId }
      : column === 'equipped_title'
        ? { equipped_title: itemId }
        : column === 'equipped_background'
          ? { equipped_background: itemId }
          : { equipped_portrait: itemId };
  const { error } = await supabase.from('profiles').update(patch).eq('id', profileId);

  if (error) {
    return fail(`Could not equip ${slot}: ${error.message}`);
  }
  return ok(null);
}

/** Minimal catalogue lookup used by the equip gate (id → slug). */
async function catalogItemById(
  itemId: string,
): Promise<RepoResult<{ id: string; slug: string } | null>> {
  const { data, error } = await supabase
    .from('cosmetics')
    .select('id, slug')
    .eq('id', itemId)
    .maybeSingle();
  if (error) {
    return fail(`Could not look up cosmetic: ${error.message}`);
  }
  return ok(data ?? null);
}

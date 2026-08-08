import { supabase } from '@/data/supabase';
import type { QuestCategory } from '@/domain/recommendation/types';
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
    .select('id, display_name, onboarded, journey_quests, current_chapter')
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

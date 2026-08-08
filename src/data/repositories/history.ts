import { supabase } from '@/data/supabase';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

const HISTORY_WINDOW_DAYS = 30;
export const HISTORY_PAGE_SIZE = 20;

export interface CompletionHistoryRow {
  questId: string;
  questSlug: string | null;
  questTitle: string | null;
  completedAt: string;
  dayKey: string | null;
  xp: number;
}

/**
 * S8-01 — paged quest-completion history (FR-PROF-1), same 30-day window as
 * the board's `fetchRecentCompletions`, ordered `completed_at` DESC. Reviews
 * only read-own (RLS); paging is limit/offset so "Load more" can walk it
 * page by page.
 */
export async function fetchCompletionHistory(
  profileId: string,
  options: { limit: number; offset: number } = { limit: HISTORY_PAGE_SIZE, offset: 0 },
): Promise<RepoResult<CompletionHistoryRow[]>> {
  const cutoff = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('quest_completions')
    .select('quest_id, completed_at, day_key, xp_awarded, quests(slug, title)')
    .eq('profile_id', profileId)
    .gte('completed_at', cutoff)
    .order('completed_at', { ascending: false })
    .range(options.offset, options.offset + options.limit - 1);

  if (error) {
    return fail(`Could not load completion history: ${error.message}`);
  }

  return ok(
    (data ?? []).map((row) => ({
      questId: row.quest_id,
      questSlug: row.quests?.slug ?? null,
      questTitle: row.quests?.title ?? null,
      completedAt: row.completed_at as string,
      dayKey: row.day_key,
      xp: row.xp_awarded ?? 0,
    })),
  );
}

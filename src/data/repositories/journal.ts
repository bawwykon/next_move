import { supabase } from '@/data/supabase';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

/**
 * PH4-01 — journal window. Wider than the board/history 30-day read so the
 * journal feels like a record of the adventure, still bounded (500 rows).
 */
const JOURNAL_WINDOW_DAYS = 365;
const JOURNAL_ROW_CAP = 500;

export interface JournalRow {
  questTitle: string | null;
  completedAt: string;
  dayKey: string | null;
  durationSec: number | null;
  xp: number;
  /** Mastery tracks that leveled up during this completion ('strength'…). */
  masteredTracks: string[];
}

/**
 * PH4-01 — every completion becomes a journal entry; no new table, this is a
 * read-only projection of quest_completions (RLS select-own) with the quest
 * title joined. Custom workouts land here through their sentinel quest row
 * ("Custom Workout") — no per-custom name is stored on completions.
 */
export async function fetchJournalEntries(profileId: string): Promise<RepoResult<JournalRow[]>> {
  const cutoff = new Date(Date.now() - JOURNAL_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('quest_completions')
    .select('completed_at, day_key, duration_sec, xp_awarded, mastered, quests(title)')
    .eq('profile_id', profileId)
    .not('completed_at', 'is', null)
    .gte('completed_at', cutoff)
    .order('completed_at', { ascending: false })
    .limit(JOURNAL_ROW_CAP);

  if (error) {
    return fail(`Could not load your journal: ${error.message}`);
  }

  return ok(
    (data ?? []).map((row) => ({
      questTitle: row.quests?.title ?? null,
      completedAt: row.completed_at as string,
      dayKey: row.day_key,
      durationSec: row.duration_sec ?? null,
      xp: row.xp_awarded ?? 0,
      masteredTracks: row.mastered ?? [],
    })),
  );
}

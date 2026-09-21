import { supabase } from '@/data/supabase';
import { parseWorldQuestsWeek, type WorldQuestsWeek } from '@/domain/worldQuests/model';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

export interface WorldQuestsClaim {
  xpAwarded: number;
  newTotal: number;
  newLevel: number;
}

/**
 * JOURNEY-WORLD-QUESTS — weekly adventure board (migration 0060). The row is
 * created lazily by ensure (3 random objectives, progress backfilled), so the
 * map can call week() on every open unconditionally.
 */
export async function fetchWorldQuestsWeek(weekKey: string): Promise<RepoResult<WorldQuestsWeek>> {
  const { data, error } = await supabase.rpc('ensure_world_quests', { p_week: weekKey });
  if (error) {
    return fail(`Could not load world quests: ${error.message}`);
  }
  const parsed = parseWorldQuestsWeek(data);
  if (!parsed) {
    return fail('Could not load world quests: bad row.');
  }
  return ok(parsed);
}

export async function rerollWorldQuest(
  weekKey: string,
  index: number,
): Promise<RepoResult<WorldQuestsWeek>> {
  const { data, error } = await supabase.rpc('reroll_world_quest', {
    p_week: weekKey,
    p_index: index,
  });
  if (error) {
    return fail(`Could not reroll: ${error.message}`);
  }
  const parsed = parseWorldQuestsWeek(data);
  if (!parsed) {
    return fail('Could not reroll: bad row.');
  }
  return ok(parsed);
}

export async function claimWorldQuests(weekKey: string): Promise<RepoResult<WorldQuestsClaim>> {
  const { data, error } = await supabase.rpc('claim_world_quests_reward', { p_week: weekKey });
  if (error) {
    return fail(`Could not claim: ${error.message}`);
  }
  if (typeof data !== 'object' || data === null) {
    return fail('Could not claim: bad receipt.');
  }
  const receipt = data as Record<string, unknown>;
  if (
    typeof receipt['xp_awarded'] !== 'number' ||
    typeof receipt['new_total'] !== 'number' ||
    typeof receipt['new_level'] !== 'number'
  ) {
    return fail('Could not claim: bad receipt.');
  }
  return ok({
    xpAwarded: receipt['xp_awarded'],
    newTotal: receipt['new_total'],
    newLevel: receipt['new_level'],
  });
}

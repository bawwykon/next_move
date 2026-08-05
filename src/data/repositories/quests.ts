import { supabase } from '@/data/supabase';
import type { QuestCategory, QuestDifficulty } from '@/domain/recommendation/types';
import { fail, ok, type RepoResult } from '@/data/repositories/repoResult';

const DIFFICULTY_RANK: Record<QuestDifficulty, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  elite: 3,
};

export interface ActiveQuest {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: QuestDifficulty;
  xpReward: number;
  durationSec: number;
  categories: QuestCategory[];
  segmentCount: number;
  totalDurationSec: number;
}

/**
 * Active quest catalog with denormalized segment counts for cards,
 * sorted by difficulty ladder then slug (deterministic).
 */
export async function fetchActiveQuests(): Promise<RepoResult<ActiveQuest[]>> {
  const { data, error } = await supabase
    .from('quests')
    .select(
      'id, slug, title, description, difficulty, xp_reward, duration_sec, categories, quest_segments(duration_sec)',
    )
    .eq('active', true);

  if (error) {
    return fail(`Could not load quests: ${error.message}`);
  }

  const quests: ActiveQuest[] = (data ?? []).map((row) => {
    const segmentDurations = row.quest_segments ?? [];
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty as QuestDifficulty,
      xpReward: row.xp_reward,
      durationSec: row.duration_sec,
      categories: row.categories as QuestCategory[],
      segmentCount: segmentDurations.length,
      totalDurationSec: segmentDurations.reduce((sum, segment) => sum + segment.duration_sec, 0),
    };
  });

  quests.sort(
    (a, b) =>
      DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || a.slug.localeCompare(b.slug),
  );

  return ok(quests);
}

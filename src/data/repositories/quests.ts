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

export type QuestSegmentKind = 'warmup' | 'work' | 'rest' | 'cooldown';

export interface QuestSegment {
  position: number;
  kind: QuestSegmentKind;
  durationSec: number;
  exerciseName: string | null;
}

export interface QuestDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: QuestDifficulty;
  xpReward: number;
  durationSec: number;
  categories: QuestCategory[];
  segments: QuestSegment[];
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

/**
 * Single quest for the detail screen: contents + ordered segments with
 * exercise names resolved via the exercise_library join (Rest segments have
 * no exercise). Sorted by position; quest duration is authoritative, the
 * segment sum is a sanity check surfaced by segmentsTotal.
 */
export async function fetchQuestDetail(questId: string): Promise<RepoResult<QuestDetail>> {
  const { data, error } = await supabase
    .from('quests')
    .select(
      'id, slug, title, description, difficulty, xp_reward, duration_sec, categories, quest_segments(position, kind, duration_sec, exercise_library(name))',
    )
    .eq('id', questId)
    .maybeSingle();

  if (error) {
    return fail(`Could not load quest: ${error.message}`);
  }
  if (!data) {
    return fail('Quest not found.');
  }

  const segments: QuestSegment[] = (data.quest_segments ?? [])
    .map((row) => ({
      position: row.position,
      kind: row.kind as QuestSegmentKind,
      durationSec: row.duration_sec,
      exerciseName: row.exercise_library?.name ?? null,
    }))
    .sort((a, b) => a.position - b.position);

  return ok({
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    difficulty: data.difficulty as QuestDifficulty,
    xpReward: data.xp_reward,
    durationSec: data.duration_sec,
    categories: data.categories as QuestCategory[],
    segments,
  });
}

/**
 * S5-05 — completion event + authoritative result shapes (Ref 06 §complete_quest).
 *
 * The event is the ONLY thing the client sends; every XP/level/streak/mastery
 * figure is recomputed server-side. The result is the RPC payload shape as
 * returned by complete_quest (S5-01) — field names stay snake_case so the
 * stored authoritative payload is byte-faithful to the server.
 */
import type { QuestCategory } from '@/domain/recommendation/types';

export interface CompletionEvent {
  quest_id: string;
  idempotency_key: string;
  started_at: string;
  completed_at: string;
  day_key: string;
}

export interface XpBreakdown {
  quest: number;
  daily: number;
  weekly: number;
  streak: number;
  total: number;
}

export interface LevelResult {
  before: number;
  after: number;
  title: string;
}

export interface MasteryResult {
  track: QuestCategory;
  points_before: number;
  points_after: number;
  level_before: number;
  level_after: number;
}

export interface JourneyResult {
  quests: number;
  chapter_before: number;
  chapter_after: number;
  next_threshold: number | null;
}

export interface UnlockRecord {
  id: string;
  slug: string;
  unlocked_at: string;
}

export interface AchievementUnlock extends UnlockRecord {
  title: string;
  category: string;
}

export interface CosmeticUnlock extends UnlockRecord {
  type: string;
  name: string;
}

export interface CompletionResult {
  xp: XpBreakdown;
  level: LevelResult;
  mastery: MasteryResult[];
  journey: JourneyResult;
  streak: { current: number; longest: number };
  achievements: AchievementUnlock[];
  cosmetics: CosmeticUnlock[];
}

const TRACKS: readonly string[] = ['strength', 'endurance', 'mobility', 'discipline'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isCompletionResult(value: unknown): value is CompletionResult {
  if (!isRecord(value)) {
    return false;
  }
  const { xp, level, mastery, journey, streak, achievements, cosmetics } = value;

  if (!isRecord(xp)) {
    return false;
  }
  const xpKeys: (keyof XpBreakdown)[] = ['quest', 'daily', 'weekly', 'streak', 'total'];
  if (!xpKeys.every((key) => isFiniteNumber(xp[key]))) {
    return false;
  }

  if (!isRecord(level)) {
    return false;
  }
  if (!isFiniteNumber(level.before) || !isFiniteNumber(level.after) || !isString(level.title)) {
    return false;
  }

  if (!isRecord(streak)) {
    return false;
  }
  if (!isFiniteNumber(streak.current) || !isFiniteNumber(streak.longest)) {
    return false;
  }

  if (!isRecord(journey)) {
    return false;
  }
  if (
    !isFiniteNumber(journey.quests) ||
    !isFiniteNumber(journey.chapter_before) ||
    !isFiniteNumber(journey.chapter_after) ||
    !(journey.next_threshold === null || isFiniteNumber(journey.next_threshold))
  ) {
    return false;
  }

  if (!Array.isArray(mastery)) {
    return false;
  }
  for (const entry of mastery) {
    if (
      !isRecord(entry) ||
      !isString(entry.track) ||
      !TRACKS.includes(entry.track) ||
      !isFiniteNumber(entry.points_before) ||
      !isFiniteNumber(entry.points_after) ||
      !isFiniteNumber(entry.level_before) ||
      !isFiniteNumber(entry.level_after)
    ) {
      return false;
    }
  }

  if (!Array.isArray(achievements) || !Array.isArray(cosmetics)) {
    return false;
  }
  const unlockOk = (unlock: unknown): boolean =>
    isRecord(unlock) &&
    isString(unlock.id) &&
    isString(unlock.slug) &&
    isString(unlock.unlocked_at);
  if (!achievements.every(unlockOk) || !cosmetics.every(unlockOk)) {
    return false;
  }

  return true;
}

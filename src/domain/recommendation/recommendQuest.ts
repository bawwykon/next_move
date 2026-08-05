import type {
  CompletionRecord,
  MasterySummary,
  OnboardingAnswers,
  QuestCatalogEntry,
  QuestCategory,
  QuestDifficulty,
} from './types';

export const GENTLE_RETURN_GAP_DAYS = 2;
export const GENTLE_RETURN_MAX_DURATION_SEC = 600;
export const ROTATION_WINDOW_DAYS = 3;
export const EASY_LADDER_MAX_COMPLETIONS = 7;
export const NORMAL_LADDER_MAX_COMPLETIONS = 20;
export const ELITE_MIN_COMPLETIONS = 30;

const DAY_MS = 86_400_000;

const CATEGORY_ORDER: QuestCategory[] = ['strength', 'endurance', 'mobility', 'discipline'];

const DIFFICULTY_ORDER: QuestDifficulty[] = ['easy', 'normal', 'hard', 'elite'];

function pickBySlug(pool: QuestCatalogEntry[]): QuestCatalogEntry | undefined {
  return [...pool].sort((a, b) => a.slug.localeCompare(b.slug))[0];
}

/**
 * Ref 08 §8.1 — after a break of 2+ days, return with a short, easy quest.
 * Mobility bias: prefer mobility if any short easy quest exists there.
 */
export function gentleReturnRecommendation(
  now: Date,
  lastCompletionDate: Date | null,
  catalog: QuestCatalogEntry[],
): string | null {
  if (!lastCompletionDate) {
    return null;
  }
  const gapMs = now.getTime() - lastCompletionDate.getTime();
  if (gapMs < GENTLE_RETURN_GAP_DAYS * DAY_MS) {
    return null;
  }
  const shortEasy = catalog.filter(
    (quest) => quest.difficulty === 'easy' && quest.durationSec <= GENTLE_RETURN_MAX_DURATION_SEC,
  );
  const mobility = shortEasy.filter((quest) => quest.categories.includes('mobility'));
  const pool = mobility.length > 0 ? mobility : shortEasy;
  return pickBySlug(pool)?.id ?? null;
}

/**
 * Ref 08 §8.2 — category least completed in the last 3 days (window anchored at
 * the most recent completion, so the ranking is deterministic without `now`);
 * ties go to the least-advanced track, then a fixed category order. Within the
 * category, pick the quest with the longest idle time (never-completed first);
 * ties break on slug order.
 */
export function rotationRecommendation(
  recentCompletions: CompletionRecord[],
  mastery: MasterySummary,
  catalog: QuestCatalogEntry[],
): string | null {
  if (catalog.length === 0) {
    return null;
  }
  const timestamps = recentCompletions.map((record) => Date.parse(record.completedAt));
  const maxCompletedAt = Math.max(0, ...timestamps);
  const windowStart = maxCompletedAt - (ROTATION_WINDOW_DAYS - 1) * DAY_MS;
  const windowed = recentCompletions.filter(
    (record) => Date.parse(record.completedAt) >= windowStart,
  );

  const counts: Record<QuestCategory, number> = {
    strength: 0,
    endurance: 0,
    mobility: 0,
    discipline: 0,
  };
  for (const record of windowed) {
    counts[record.category] += 1;
  }

  const lastDoneAt = new Map<string, number>();
  for (const record of recentCompletions) {
    const ts = Date.parse(record.completedAt);
    if (!lastDoneAt.has(record.questId) || ts > lastDoneAt.get(record.questId)!) {
      lastDoneAt.set(record.questId, ts);
    }
  }

  const category = CATEGORY_ORDER.filter((candidate) =>
    catalog.some((quest) => quest.categories.includes(candidate)),
  ).sort(
    (a, b) =>
      counts[a] - counts[b] ||
      mastery.points[a] - mastery.points[b] ||
      CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  )[0];

  if (!category) {
    return null;
  }
  const idleTime = (questId: string): number => {
    const last = lastDoneAt.get(questId);
    return last === undefined ? Number.POSITIVE_INFINITY : maxCompletedAt - last;
  };
  const candidates = catalog.filter((quest) => quest.categories.includes(category!));
  return (
    [...candidates].sort(
      (a, b) => idleTime(b.id) - idleTime(a.id) || a.slug.localeCompare(b.slug),
    )[0]?.id ?? null
  );
}

/**
 * Ref 08 §8.3 — difficulty ladder. First 7 lifetime completions → easy,
 * 8–20 → normal, 21+ → normal/hard alternating by day parity (even days the
 * harder tier). Elite is only ever recommended from ≥ 30 completions AND at
 * least one hard quest completed.
 */
export function recommendedDifficulty(
  lifetimeCompletions: number,
  hasCompletedHard: boolean,
  now: Date,
): QuestDifficulty {
  if (lifetimeCompletions < 8) {
    return 'easy';
  }
  if (lifetimeCompletions < 21) {
    return 'normal';
  }
  if (now.getDate() % 2 !== 0) {
    return 'normal';
  }
  if (hasCompletedHard && lifetimeCompletions >= ELITE_MIN_COMPLETIONS) {
    return 'elite';
  }
  return 'hard';
}

export function hasCompletedHardQuest(
  recentCompletions: CompletionRecord[],
  catalog: QuestCatalogEntry[],
): boolean {
  const hardQuestIds = new Set(
    catalog.filter((quest) => quest.difficulty === 'hard').map((quest) => quest.id),
  );
  return recentCompletions.some((record) => hardQuestIds.has(record.questId));
}

function questForDifficulty(
  category: QuestCategory,
  difficulty: QuestDifficulty,
  catalog: QuestCatalogEntry[],
): QuestCatalogEntry | undefined {
  const inCategory = catalog.filter((quest) => quest.categories.includes(category));
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  const order: QuestDifficulty[] = [difficulty];
  for (let step = 1; step < DIFFICULTY_ORDER.length; step += 1) {
    if (index + step < DIFFICULTY_ORDER.length) {
      order.push(DIFFICULTY_ORDER[index + step]!);
    }
    if (index - step >= 0) {
      order.push(DIFFICULTY_ORDER[index - step]!);
    }
  }
  for (const candidate of order) {
    const match = inCategory.filter((quest) => quest.difficulty === candidate);
    if (match.length > 0) {
      return pickBySlug(match);
    }
  }
  return undefined;
}

/**
 * Ref 08 §8 — deterministic recommendation. Gentle return has priority #1;
 * otherwise rotation picks the category and the ladder picks the difficulty
 * within it. `onboarding` is accepted for signature parity with Ref 06 (plan
 * inputs are stored server-side); the spec's rules do not consume it.
 */
export function recommendQuest(
  now: Date,
  _onboarding: OnboardingAnswers,
  mastery: MasterySummary,
  recentCompletions: CompletionRecord[],
  catalog: QuestCatalogEntry[],
): string | null {
  const lastCompletionMs = recentCompletions.reduce(
    (max, record) => Math.max(max, Date.parse(record.completedAt)),
    0,
  );
  const lastCompletionDate = lastCompletionMs > 0 ? new Date(lastCompletionMs) : null;

  const gentle = gentleReturnRecommendation(now, lastCompletionDate, catalog);
  if (gentle) {
    return gentle;
  }

  const rotationQuestId = rotationRecommendation(recentCompletions, mastery, catalog);
  if (!rotationQuestId) {
    return null;
  }
  const rotationQuest = catalog.find((quest) => quest.id === rotationQuestId);
  if (!rotationQuest) {
    return null;
  }
  const category = CATEGORY_ORDER.find((candidate) => rotationQuest.categories.includes(candidate));
  if (!category) {
    return rotationQuestId;
  }

  const difficulty = recommendedDifficulty(
    recentCompletions.length,
    hasCompletedHardQuest(recentCompletions, catalog),
    now,
  );
  return questForDifficulty(category, difficulty, catalog)?.id ?? rotationQuestId;
}

/**
 * Ref 08 §8.5 — 2–3 alternative quests: next in rotation order, one per
 * category, never the primary.
 */
export function alternatives(
  primaryQuestId: string,
  recentCompletions: CompletionRecord[],
  mastery: MasterySummary,
  catalog: QuestCatalogEntry[],
): string[] {
  const primary = catalog.find((quest) => quest.id === primaryQuestId);
  const primaryCategory = primary
    ? CATEGORY_ORDER.find((candidate) => primary.categories.includes(candidate))
    : undefined;

  const timestamps = recentCompletions.map((record) => Date.parse(record.completedAt));
  const maxCompletedAt = Math.max(0, ...timestamps);
  const windowStart = maxCompletedAt - (ROTATION_WINDOW_DAYS - 1) * DAY_MS;
  const windowed = recentCompletions.filter(
    (record) => Date.parse(record.completedAt) >= windowStart,
  );
  const counts: Record<QuestCategory, number> = {
    strength: 0,
    endurance: 0,
    mobility: 0,
    discipline: 0,
  };
  for (const record of windowed) {
    counts[record.category] += 1;
  }

  const lastDoneAt = new Map<string, number>();
  for (const record of recentCompletions) {
    const ts = Date.parse(record.completedAt);
    if (!lastDoneAt.has(record.questId) || ts > lastDoneAt.get(record.questId)!) {
      lastDoneAt.set(record.questId, ts);
    }
  }
  const idleTime = (questId: string): number => {
    const last = lastDoneAt.get(questId);
    return last === undefined ? Number.POSITIVE_INFINITY : maxCompletedAt - last;
  };

  const categories = CATEGORY_ORDER.filter(
    (candidate) =>
      candidate !== primaryCategory &&
      catalog.some((quest) => quest.categories.includes(candidate)),
  ).sort(
    (a, b) =>
      counts[a] - counts[b] ||
      mastery.points[a] - mastery.points[b] ||
      CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  );

  const result: string[] = [];
  for (const category of categories) {
    const candidates = catalog.filter(
      (quest) => quest.categories.includes(category) && quest.id !== primaryQuestId,
    );
    const pick = [...candidates].sort(
      (a, b) => idleTime(b.id) - idleTime(a.id) || a.slug.localeCompare(b.slug),
    )[0];
    if (pick) {
      result.push(pick.id);
    }
    if (result.length >= 3) {
      break;
    }
  }
  return result;
}

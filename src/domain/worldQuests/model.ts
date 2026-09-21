/**
 * JOURNEY-WORLD-QUESTS — client mirror of the server-owned weekly adventure
 * board (migration 0060). Pure display + validation only: the pool goals here
 * must match public.world_quest_pool(); progress, rerolls, and the jackpot
 * always come from the RPCs. week_key is the Monday 'YYYY-MM-DD' of the
 * local week (same Monday math as the streak domain — never UTC fields).
 */
import { dayKey, dayKeyToUtcMs } from '@/domain/streak/dayKey';
import { mondayOfWeek } from '@/domain/streak/week';

export type WorldQuestKey =
  | 'wq_strength'
  | 'wq_endurance'
  | 'wq_mobility'
  | 'wq_discipline'
  | 'wq_any_3'
  | 'wq_days_3'
  | 'wq_hard_1'
  | 'wq_custom_1';

export interface WorldQuestPoolEntry {
  key: WorldQuestKey;
  goal: number;
}

/** Display mirror of public.world_quest_pool() — goals must match the DB. */
export const WORLD_QUEST_POOL: readonly WorldQuestPoolEntry[] = Object.freeze([
  { key: 'wq_strength', goal: 2 },
  { key: 'wq_endurance', goal: 2 },
  { key: 'wq_mobility', goal: 2 },
  { key: 'wq_discipline', goal: 2 },
  { key: 'wq_any_3', goal: 3 },
  { key: 'wq_days_3', goal: 3 },
  { key: 'wq_hard_1', goal: 1 },
  { key: 'wq_custom_1', goal: 1 },
]);

const POOL_KEYS = new Set(
  (WORLD_QUEST_POOL as readonly WorldQuestPoolEntry[]).map((entry) => entry.key),
);

/**
 * Monday 'YYYY-MM-DD' of the local week containing `date` (Mon–Sun).
 * mondayOfWeek returns UTC-midnight of the local Monday (dayKeyToUtcMs
 * convention), so UTC getters read the calendar date back exactly.
 */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function worldQuestWeekKey(date: Date = new Date()): string {
  const mondayMs = mondayOfWeek(dayKey(date));
  if (mondayMs === null) {
    // dayKey() always emits a valid key, so this is unreachable; fall back
    // to this week's Monday computed directly rather than today's date
    // (a mid-week fallback date would split the week).
    const fallback = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysSinceMonday = (fallback.getDay() + 6) % 7;
    const monday = new Date(
      fallback.getFullYear(),
      fallback.getMonth(),
      fallback.getDate() - daysSinceMonday,
    );
    return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
  }
  const monday = new Date(mondayMs);
  // mondayMs is UTC-midnight of the local Monday (dayKeyToUtcMs convention),
  // so UTC getters read the calendar date back exactly.
  return `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`;
}

export function isWorldQuestKey(value: unknown): value is WorldQuestKey {
  return typeof value === 'string' && POOL_KEYS.has(value as WorldQuestKey);
}

export function goalForWorldQuestKey(key: WorldQuestKey): number {
  return WORLD_QUEST_POOL.find((entry) => entry.key === key)?.goal ?? 0;
}

export interface WorldQuestObjective {
  key: WorldQuestKey;
  goal: number;
  progress: number;
}

export interface WorldQuestsWeek {
  weekKey: string;
  objectives: WorldQuestObjective[];
  rerollsRemaining: number;
  completed: boolean;
  claimed: boolean;
}

function toFiniteInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
}

/**
 * Parse an ensure/reroll RPC row (to_jsonb of world_quests). Unknown
 * objective keys are dropped (forward-compat); short lists are NOT padded —
 * the server always deals exactly 3.
 */
export function parseWorldQuestsWeek(row: unknown): WorldQuestsWeek | null {
  if (typeof row !== 'object' || row === null) {
    return null;
  }
  const record = row as Record<string, unknown>;
  if (typeof record['week_key'] !== 'string') {
    return null;
  }
  const rawObjectives = Array.isArray(record['objectives']) ? record['objectives'] : [];
  const objectives: WorldQuestObjective[] = [];
  for (const entry of rawObjectives) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const item = entry as Record<string, unknown>;
    if (!isWorldQuestKey(item['key'])) {
      continue;
    }
    const goal = toFiniteInt(item['goal'], goalForWorldQuestKey(item['key']));
    objectives.push({
      key: item['key'],
      goal: Math.max(0, goal),
      progress: Math.max(0, toFiniteInt(item['progress'], 0)),
    });
  }
  return {
    weekKey: record['week_key'],
    objectives,
    rerollsRemaining: Math.max(0, toFiniteInt(record['rerolls_remaining'], 0)),
    completed: record['completed'] === true,
    claimed: record['claimed'] === true,
  };
}

/** Objectives fully met (progress >= goal). */
export function doneWorldQuestCount(week: WorldQuestsWeek): number {
  return week.objectives.filter((o) => o.progress >= o.goal).length;
}

/** All dealt objectives met (and at least one dealt). */
export function isWorldQuestsComplete(week: WorldQuestsWeek): boolean {
  return week.objectives.length > 0 && doneWorldQuestCount(week) === week.objectives.length;
}

/** Claim CTA enabled: complete and not yet collected. */
export function canClaimWorldQuests(week: WorldQuestsWeek): boolean {
  return isWorldQuestsComplete(week) && !week.claimed;
}

/** Reroll affordance for one row: spares left, unclaimed, goal unmet. */
export function canRerollObjective(week: WorldQuestsWeek, index: number): boolean {
  const objective = week.objectives[index];
  if (!objective || week.claimed || week.rerollsRemaining <= 0) {
    return false;
  }
  return objective.progress < objective.goal;
}

export function isCurrentWorldQuestWeek(weekKey: string, today: Date = new Date()): boolean {
  if (dayKeyToUtcMs(weekKey) === null) {
    return false;
  }
  return weekKey === worldQuestWeekKey(today);
}

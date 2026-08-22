import { colors } from '@/lib/theme';
import type { QuestDifficulty } from '@/domain/recommendation/types';

export interface DifficultyBadge {
  label: string;
  color: string;
}

const BADGES: Record<QuestDifficulty, DifficultyBadge> = {
  easy: { label: 'A gentle start', color: colors.calm },
  normal: { label: 'A steady step', color: colors.rewardStrong },
  hard: { label: 'A real challenge', color: colors.danger },
};

/** FR-BOARD-2/3 — friendly label + theme color per difficulty (§7.5 tone). */
export function difficultyBadge(difficulty: QuestDifficulty): DifficultyBadge {
  return BADGES[difficulty];
}

/**
 * BYQ-04b — verbatim zone descriptors (Planner ruling 2026-08-22), shown with
 * the zone label on the builder meter legend and the custom-detail pill.
 */
export const DIFFICULTY_DESCRIPTORS: Record<QuestDifficulty, string> = {
  easy: 'A gentle start is easy',
  normal: 'A steady step is normal',
  hard: 'A real challenge is hard',
};

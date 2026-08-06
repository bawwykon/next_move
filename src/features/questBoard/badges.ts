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
  elite: { label: 'The big one', color: colors.danger },
};

/** FR-BOARD-2/3 — friendly label + theme color per difficulty (§7.5 tone). */
export function difficultyBadge(difficulty: QuestDifficulty): DifficultyBadge {
  return BADGES[difficulty];
}

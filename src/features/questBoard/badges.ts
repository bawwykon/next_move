import type { TFunction } from 'i18next';

import { colors } from '@/lib/theme';
import type { QuestDifficulty } from '@/domain/recommendation/types';

export interface DifficultyBadge {
  label: string;
  color: string;
}

const BADGE_COLORS: Record<QuestDifficulty, string> = {
  easy: colors.calm,
  normal: colors.rewardStrong,
  hard: colors.danger,
};

/** FR-BOARD-2/3 — friendly label + theme color per difficulty (§7.5 tone). */
export function difficultyBadge(difficulty: QuestDifficulty, t: TFunction): DifficultyBadge {
  return { label: t(`board.difficulty.${difficulty}`), color: BADGE_COLORS[difficulty] };
}

/**
 * BYQ-04b — zone phrases shown on the board's "Your Quests" pills (instead
 * of the bare Easy/Normal/Hard words). Same copy as the badges.
 */
export function difficultyDescriptor(difficulty: QuestDifficulty, t: TFunction): string {
  return t(`board.difficulty.${difficulty}`);
}

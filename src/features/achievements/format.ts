/**
 * S7-02 — pure display helpers for the Achievements screen (FR-ACH-4/5).
 * Ever-y string the locked state can produce is produced here, so the leak
 * guard in tests/features/achievements/format.test.ts pins FR-ACH-4's secrecy
 * decision over exactly these outputs.
 */
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import {
  LOCKED_EMBLEM,
  lockedCopy,
  type AchievementCategory,
  type AchievementRow,
} from '@/domain/achievements/merge';

export interface CategoryArt {
  icon: ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  blobColor: string;
}

export const ACHIEVEMENT_CATEGORY_ART: Record<AchievementCategory, CategoryArt> = {
  beginner: { icon: 'sparkles', iconColor: '#5EEAD4', blobColor: '#123B36' },
  progress: { icon: 'trending-up', iconColor: '#FCD34D', blobColor: '#3B2E12' },
  consistency: { icon: 'flame', iconColor: '#FDBA74', blobColor: '#3B2312' },
  special: { icon: 'star', iconColor: '#C4B5FD', blobColor: '#2B1B3E' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Unlocked Aug 8, 2026" — deterministic across hosts (UTC frame, no locale).
 */
export function unlockedLabel(unlockedAtISO: string): string {
  const date = new Date(unlockedAtISO);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `Unlocked ${MONTHS[date.getUTCMonth()] ?? ''} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/**
 * The ONLY strings a locked row is allowed to render (FR-ACH-4: "?" + vague
 * hint — no description, no trigger, no rule math).
 */
export function lockedRowStrings(row: AchievementRow): string[] {
  const copy = lockedCopy(row.hint ?? null);
  return [copy.emblem, row.title, copy.hint];
}

/**
 * The strings an unlocked row renders: title, description, unlock date.
 */
export function unlockedRowStrings(row: AchievementRow): string[] {
  const label = row.unlockedAt ? unlockedLabel(row.unlockedAt) : '';
  return [row.title, row.description ?? '', label];
}

export { LOCKED_EMBLEM };

/**
 * S7-02 — pure display helpers for the Achievements screen (FR-ACH-4/5).
 * Ever-y string the locked state can produce is produced here, so the leak
 * guard in tests/features/achievements/format.test.ts pins FR-ACH-4's secrecy
 * decision over exactly these outputs.
 */
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';

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

/**
 * Localized unlock timestamp — "Unlocked Aug 8, 2026" (UTC frame,
 * deterministic across hosts). Month names and order come from the locale
 * tables via `t` (I18N-01, shared `profile.months` pool).
 */
export function unlockedLabel(unlockedAtISO: string, t: TFunction): string {
  const date = new Date(unlockedAtISO);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const months = t('profile.months', { returnObjects: true }) as unknown as string[];
  const mon = months[date.getUTCMonth()] ?? '';
  return t('achievements.unlockedDate', {
    mon,
    d: date.getUTCDate(),
    y: date.getUTCFullYear(),
  });
}

/**
 * The ONLY strings a locked row is allowed to render (FR-ACH-4: "?" + vague
 * hint — no description, no trigger, no rule math).
 */
export function lockedRowStrings(row: AchievementRow, t: TFunction): string[] {
  const copy = lockedCopy(row.hint ?? null, t);
  return [copy.emblem, row.title, copy.hint];
}

/**
 * The strings an unlocked row renders: title, description, unlock date.
 */
export function unlockedRowStrings(row: AchievementRow, t: TFunction): string[] {
  const label = row.unlockedAt ? unlockedLabel(row.unlockedAt, t) : '';
  return [row.title, row.description ?? '', label];
}

export { LOCKED_EMBLEM };

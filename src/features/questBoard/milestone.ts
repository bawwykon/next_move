/**
 * Big-3 NEXT-MILESTONE — board copy for the anchor card. Pure: every string
 * resolves through `t` (I18N-01); numbers stay numeric for RTL-safe layouts.
 */
import type { TFunction } from 'i18next';

import { chapterName } from '@/features/catalog/copy';
import { levelTitleFor } from '@/features/profile/format';
import { CHAPTERS } from '@/domain/journey/chapter';
import type { NextMilestone } from '@/domain/board/nextMilestone';

export interface MilestoneCopy {
  kicker: string;
  line: string;
  meta: string;
}

export function milestoneCopy(milestone: NextMilestone, t: TFunction): MilestoneCopy {
  const kicker = t('board.milestone.kicker');
  if (milestone.kind === 'streak') {
    return {
      kicker,
      line: t('board.milestone.streak', {
        count: milestone.remaining,
        days: milestone.ref,
      }),
      meta: t('board.milestone.streakMeta', {
        done: milestone.done,
        target: milestone.target,
      }),
    };
  }
  if (milestone.kind === 'level') {
    return {
      kicker,
      line: t('board.milestone.level', {
        xp: milestone.remaining,
        level: milestone.ref,
        title: levelTitleFor(milestone.ref, t),
      }),
      meta: t('board.milestone.levelMeta', {
        done: milestone.done,
        target: milestone.target,
      }),
    };
  }
  const chapter = CHAPTERS[milestone.ref - 1] ?? null;
  return {
    kicker,
    line: t('board.milestone.chapter', {
      count: milestone.remaining,
      id: milestone.ref,
      name: chapter ? chapterName(chapter.id, chapter.name, t) : '',
    }),
    meta: t('board.milestone.chapterMeta', {
      done: milestone.done,
      target: milestone.target,
    }),
  };
}

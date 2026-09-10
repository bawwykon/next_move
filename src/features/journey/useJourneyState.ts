/**
 * JOURNEY-01 — pure derivation hook for journey map state.
 * Reads existing profile data (current_chapter, journey_quests) and returns
 * chapter states (completed/current/locked) with progress fractions.
 */
import { useMemo } from 'react';

import { chapterForQuests } from '@/domain/journey/chapter';
import { CHAPTER_DATA, nextChapterThreshold, type ChapterData } from './journeyData';

export type ChapterState = 'completed' | 'current' | 'locked';

export interface JourneyChapter {
  data: ChapterData;
  state: ChapterState;
  /** 0..1 progress within this chapter. */
  fraction: number;
  /** Quests completed within this chapter (0 for locked, span for completed). */
  questsInChapter: number;
  /** Total quests needed to complete this chapter (span). null for Mastery Peak. */
  span: number | null;
}

export interface JourneyState {
  chapters: JourneyChapter[];
  currentChapter: JourneyChapter | null;
  totalQuests: number;
}

export function useJourneyState(journeyQuestCount: number): JourneyState {
  return useMemo(() => {
    const progress = chapterForQuests(journeyQuestCount);
    const currentThreshold = progress.current.threshold;
    const nextThreshold = nextChapterThreshold(currentThreshold);

    const chapters: JourneyChapter[] = CHAPTER_DATA.map((data) => {
      const isCompleted = data.threshold < currentThreshold;
      const isCurrent = data.threshold === currentThreshold;

      if (isCompleted) {
        const nextTh = nextChapterThreshold(data.threshold);
        const span = nextTh !== null ? nextTh - data.threshold : null;
        return {
          data,
          state: 'completed' as ChapterState,
          fraction: 1,
          questsInChapter: span ?? 0,
          span,
        };
      }

      if (isCurrent) {
        const span = nextThreshold !== null ? nextThreshold - currentThreshold : null;
        const questsInChapter = progress.questsSinceChapterStart;
        const fraction = span !== null ? Math.min(1, Math.max(0, questsInChapter / span)) : 1;
        return {
          data,
          state: 'current' as ChapterState,
          fraction,
          questsInChapter,
          span,
        };
      }

      // locked
      return {
        data,
        state: 'locked' as ChapterState,
        fraction: 0,
        questsInChapter: 0,
        span: null,
      };
    });

    const currentChapter = chapters.find((c) => c.state === 'current') ?? null;

    return { chapters, currentChapter, totalQuests: journeyQuestCount };
  }, [journeyQuestCount]);
}

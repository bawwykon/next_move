/**
 * S7-01 — pure display formatting for the Journey Map (FR-JOURNEY-5/8). All
 * copy rides on `CHAPTERS` + `chapterForQuests`; nothing here mutates, reads
 * state, or renders. Tested host-agnostically in tests/features/journey/.
 */
import { CHAPTERS, chapterForQuests } from '@/domain/journey/chapter';
import type { ChapterDef } from '@/domain/journey/chapter';

export type ChapterNodeState = 'completed' | 'current' | 'locked';

export interface ChapterNode {
  /** 1-based chapter id (CHAPTERS order). */
  id: number;
  name: string;
  state: ChapterNodeState;
  /** FR-JOURNEY-5 bar fill: 0..1 (completed chapters 1, locked 0). */
  fraction: number;
  /** Milestone copy for the node your head is at; null otherwise. */
  meta: string | null;
}

const toSentence = (count: number, chapter: ChapterDef): string =>
  `You've finished ${count} ${count === 1 ? 'quest' : 'quests'} — Chapter ${chapter.id} (${chapter.name}).`;

export function milestoneLine(questsInput: number, chapter: ChapterDef): string {
  return toSentence(Math.max(0, Math.floor(questsInput)), chapter);
}

export function goalLine(chapter: ChapterDef): string {
  return chapter.threshold === 0 ? 'The journey begins here' : `Reach ${chapter.threshold} quests`;
}

/**
 * One node per chapter, in CHAPTERS order, with its FR-JOURNEY-5 bar.
 * - chapters behind the head → completed (full bar, ✓)
 * - the current chapter → partial bar over nextThreshold − threshold;
 *   Mastery Peak is unbounded → full bar + capped meta copy
 * - chapters ahead → locked (empty bar, ∘)
 */
export function journeyNodes(questsInput: number): ChapterNode[] {
  const progress = chapterForQuests(questsInput);
  return CHAPTERS.map((chapter, index) => {
    if (index < progress.currentIndex) {
      return { id: chapter.id, name: chapter.name, state: 'completed', fraction: 1, meta: null };
    }
    if (index > progress.currentIndex) {
      return { id: chapter.id, name: chapter.name, state: 'locked', fraction: 0, meta: null };
    }

    const span = progress.next ? progress.next.threshold - progress.current.threshold : null;
    if (span === null) {
      return {
        id: chapter.id,
        name: chapter.name,
        state: 'current',
        fraction: 1,
        meta: 'The summit is yours — every next quest writes your own record.',
      };
    }
    const fraction = Math.min(1, Math.max(0, progress.questsSinceChapterStart / span));
    return {
      id: chapter.id,
      name: chapter.name,
      state: 'current',
      fraction,
      meta: `${progress.questsSinceChapterStart} of ${span} quests to the next chapter`,
    };
  });
}

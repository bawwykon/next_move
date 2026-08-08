/**
 * Ref 08 §4 — journey chapters (FR-JOURNEY-2/4). READ-ONLY catalog; the server
 * mirrors the same boundaries in `public.chapter_for_quests`
 * (supabase/migrations/0020_complete_quest.sql); tests/integration prove both
 * sides agree. No threshold may exceed 365 (FR-JOURNEY-4 tunable cap).
 */
export interface ChapterDef {
  /** 1-based chapter number — fixed by catalogue order. */
  id: number;
  name: string;
  /** Quests required to stand inside this chapter (inclusive). */
  threshold: number;
}

export const CHAPTERS: readonly ChapterDef[] = Object.freeze([
  Object.freeze({ id: 1, name: 'The First Step', threshold: 0 }),
  Object.freeze({ id: 2, name: 'Training Grounds', threshold: 10 }),
  Object.freeze({ id: 3, name: 'Into the Wild', threshold: 30 }),
  Object.freeze({ id: 4, name: 'Crossing the Bridge', threshold: 60 }),
  Object.freeze({ id: 5, name: 'The Ascent', threshold: 100 }),
  Object.freeze({ id: 6, name: 'Fortress of Discipline', threshold: 200 }),
  Object.freeze({ id: 7, name: 'Mastery Peak', threshold: 365 }),
]);

export interface ChapterProgress {
  /** Index into CHAPTERS of the chapter the quest count currently stands in. */
  currentIndex: number;
  current: ChapterDef;
  /** null past Mastery Peak — the chapter is unbounded. */
  next: ChapterDef | null;
  /** FR-JOURNEY-5 — quests since the current chapter began (count − threshold). */
  questsSinceChapterStart: number;
}

/**
 * Pure: no mutation, no I/O. `quests` clamps at 0 (FR-JOURNEY-3 metric is
 * permanent and never negative; a stale negative input means "no progress").
 */
export function chapterForQuests(questsInput: number): ChapterProgress {
  const quests = Math.max(0, questsInput);
  let currentIndex = 0;
  for (let index = CHAPTERS.length - 1; index >= 0; index -= 1) {
    if (CHAPTERS[index]!.threshold <= quests) {
      currentIndex = index;
      break;
    }
  }
  const current = CHAPTERS[currentIndex]!;
  const next = currentIndex + 1 < CHAPTERS.length ? (CHAPTERS[currentIndex + 1] ?? null) : null;
  return {
    currentIndex,
    current,
    next,
    questsSinceChapterStart: quests - current.threshold,
  };
}

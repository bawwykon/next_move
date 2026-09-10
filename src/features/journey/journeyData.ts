/**
 * JOURNEY-01 — hardcoded chapter data (names, thresholds, flavors, requirements).
 * All display-only; no mutations, no I/O.
 */

export interface ChapterData {
  id: number;
  name: string;
  threshold: number;
  flavor: string;
  requirement: string;
}

export const CHAPTER_DATA: readonly ChapterData[] = Object.freeze([
  Object.freeze({
    id: 1,
    name: 'The First Step',
    threshold: 0,
    flavor: 'Every journey begins with a single move.',
    requirement: 'Complete 1 quest',
  }),
  Object.freeze({
    id: 2,
    name: 'Training Grounds',
    threshold: 10,
    flavor: 'Foundations are built in sweat.',
    requirement: 'Reach 10 quests to unlock',
  }),
  Object.freeze({
    id: 3,
    name: 'Into the Wild',
    threshold: 30,
    flavor: 'The path gets harder — so do you.',
    requirement: 'Reach 30 quests to unlock',
  }),
  Object.freeze({
    id: 4,
    name: 'Crossing the Bridge',
    threshold: 60,
    flavor: 'Halfway is not the finish line.',
    requirement: 'Reach 60 quests to unlock',
  }),
  Object.freeze({
    id: 5,
    name: 'The Ascent',
    threshold: 100,
    flavor: 'The air gets thin, but your will is thicker.',
    requirement: 'Reach 100 quests to unlock',
  }),
  Object.freeze({
    id: 6,
    name: 'Fortress of Discipline',
    threshold: 200,
    flavor: 'Consistency is the strongest armor.',
    requirement: 'Reach 200 quests to unlock',
  }),
  Object.freeze({
    id: 7,
    name: 'Mastery Peak',
    threshold: 365,
    flavor: 'You did not climb the mountain — you became it. Your journey continues.',
    requirement: 'Reach 365 quests to unlock',
  }),
]);

export function chapterDataById(id: number): ChapterData | null {
  return CHAPTER_DATA[id - 1] ?? null;
}

export function nextChapterThreshold(currentThreshold: number): number | null {
  const idx = CHAPTER_DATA.findIndex((c) => c.threshold === currentThreshold);
  if (idx < 0 || idx >= CHAPTER_DATA.length - 1) return null;
  return CHAPTER_DATA[idx + 1]!.threshold;
}

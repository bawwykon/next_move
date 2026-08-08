import { CHAPTERS, chapterForQuests } from '@/domain/journey/chapter';

/**
 * S7-01 — journey chapter math (Ref 08 §4, FR-JOURNEY-2/4/5). Pins the full
 * catalogue and every boundary symmwith the SQL `chapter_for_quests`
 * (0020_complete_quest.sql); tests/integration/journey-proof re-checks live DB.
 */
describe('CHAPTERS catalogue', () => {
  it('is exactly the seven chapters, in order, with FR-JOURNEY-4 thresholds', () => {
    expect(CHAPTERS).toEqual([
      { id: 1, name: 'The First Step', threshold: 0 },
      { id: 2, name: 'Training Grounds', threshold: 10 },
      { id: 3, name: 'Into the Wild', threshold: 30 },
      { id: 4, name: 'Crossing the Bridge', threshold: 60 },
      { id: 5, name: 'The Ascent', threshold: 100 },
      { id: 6, name: 'Fortress of Discipline', threshold: 200 },
      { id: 7, name: 'Mastery Peak', threshold: 365 },
    ]);
  });

  it('has frozen entries (read-only catalogue, no accidental mutation)', () => {
    expect(Object.isFrozen(CHAPTERS)).toBe(true);
    for (const chapter of CHAPTERS) {
      expect(Object.isFrozen(chapter)).toBe(true);
    }
  });

  it('keeps thresholds strictly ascending with the cap at 365 (never above)', () => {
    const thresholds = CHAPTERS.map((chapter) => chapter.threshold);
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
    expect(thresholds[thresholds.length - 1]).toBe(365);
  });
});

describe('chapterForQuests boundaries (FR-JOURNEY-4)', () => {
  const cases: [number, number, string][] = [
    [0, 1, 'zero quests starts in chapter 1'],
    [9, 1, 'one short of chapter 2'],
    [10, 2, 'exactly at the C2 threshold'],
    [11, 2, 'one past C2'],
    [29, 2, 'one short of C3'],
    [30, 3, 'C3 threshold'],
    [59, 3, 'one short of C4'],
    [60, 4, 'C4 threshold'],
    [99, 4, 'one short of C5'],
    [100, 5, 'C5 threshold'],
    [199, 5, 'one short of C6'],
    [200, 6, 'C6 threshold'],
    [364, 6, 'one short of C7'],
    [365, 7, 'C7 threshold (cap)'],
    [400, 7, 'plateaued at Mastery Peak'],
  ] as const;

  it.each(cases)('maps %s quests to chapter %s — %s', (quests, chapterId) => {
    const progress = chapterForQuests(quests);
    expect(progress.currentIndex).toBe(chapterId - 1);
    expect(progress.current.id).toBe(chapterId);
    expect(progress.current.name).toBe(CHAPTERS[chapterId - 1]!.name);
    expect(progress.current.threshold).toBe(CHAPTERS[chapterId - 1]!.threshold);
  });

  it('clamps negative quest counts to 0 (same as chapter 1, zero progress)', () => {
    expect(chapterForQuests(-5)).toEqual(chapterForQuests(0));
    expect(chapterForQuests(-5).current.id).toBe(1);
  });
});

describe('questsSinceChapterStart (FR-JOURNEY-5)', () => {
  it.each([
    [0, 0],
    [5, 5], // 0..9 → inside C1, 0 done at chapter start
    [9, 9],
    [10, 0],
    [45, 15], // C3: 45 − 30
    [59, 29],
    [100, 0], // exactly at the C5 boundary: chapter-start-level progress
    [150, 50],
    [364, 164],
    [365, 0],
    [400, 35],
  ])('reports %s quests → %s quests since the current chapter began', (quests, expected) => {
    expect(chapterForQuests(quests).questsSinceChapterStart).toBe(expected);
  });

  it('exposes the next-chapter span (next threshold − current threshold)', () => {
    const c1 = chapterForQuests(5);
    expect(c1.next).toEqual(CHAPTERS[1]);
    const c5 = chapterForQuests(150);
    expect(c5.current.id).toBe(5);
    expect(c5.next!.threshold - c5.current.threshold).toBe(100);
  });

  it('has no next chapter at Mastery Peak (unbounded → FULL bar UI)', () => {
    expect(chapterForQuests(400).next).toBeNull();
    expect(chapterForQuests(365).next).toBeNull();
  });
});

describe('purity', () => {
  it('returns fresh objects and never touches the frozen catalogue', () => {
    const before = CHAPTERS.map((chapter) => ({ ...chapter }));
    const first = chapterForQuests(150);
    const second = chapterForQuests(150);
    expect(first).not.toBe(second);
    expect(first.current).toBe(CHAPTERS[4]); // read-only reference: no copy/steal
    expect(CHAPTERS.map((chapter) => ({ ...chapter }))).toEqual(before);
  });
});

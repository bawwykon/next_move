import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CHAPTERS } from '@/domain/journey/chapter';
import { goalLine, journeyNodes, milestoneLine } from '@/features/journey/format';

const VICTORY_JOURNEY_SOURCE = join(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'features',
  'victory',
  'journey.tsx',
);

describe('milestoneLine (FR-JOURNEY-1/8 milestone copy)', () => {
  it('reports the head position as "You have finished X quests — Chapter N (name)"', () => {
    const line = milestoneLine(12, CHAPTERS[1]!);
    expect(line).toBe("You've finished 12 quests — Chapter 2 (Training Grounds).");
  });

  it('correctly pluralizes a single quest', () => {
    expect(milestoneLine(1, CHAPTERS[0]!)).toBe(
      "You've finished 1 quest — Chapter 1 (The First Step).",
    );
  });
});

describe('goalLine', () => {
  it('gives the very first chapter a beginning, not a detour to zero', () => {
    expect(goalLine(CHAPTERS[0]!)).toBe('The journey begins here');
  });

  it('states each later goal as "Reach N quests"', () => {
    expect(goalLine(CHAPTERS[1]!)).toBe('Reach 10 quests');
    expect(goalLine(CHAPTERS[4]!)).toBe('Reach 100 quests');
    expect(goalLine(CHAPTERS[6]!)).toBe('Reach 365 quests');
  });
});

describe('journeyNodes (FR-JOURNEY-5 bar semantics)', () => {
  it('at 0 quests: 7 nodes, first current, rest locked, no partial bars', () => {
    const nodes = journeyNodes(0);
    expect(nodes).toHaveLength(7);
    expect(nodes.map((node) => node.state)).toEqual([
      'current',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    expect(nodes[0]!.fraction).toBe(0);
    expect(nodes[0]!.meta).toBe('0 of 10 quests to the next chapter');
    for (const node of nodes.slice(1)) {
      expect(node.fraction).toBe(0);
      expect(node.meta).toBeNull();
    }
  });

  it('renders a partial bar on the current chapter (quests since chapter start)', () => {
    // 45 quests → chapter 3 (Into the Wild, 30..59): 15 since start, span 30.
    const nodes = journeyNodes(45);
    expect(nodes.map((node) => node.state)).toContain('current');
    expect(nodes[2]!).toMatchObject({ state: 'current', fraction: 0.5 });
    expect(nodes[2]!.meta).toBe('15 of 30 quests to the next chapter');
    expect(nodes[0]!.fraction).toBe(1);
    expect(nodes[0]!.state).toBe('completed');
  });

  it('exacts the 100-quest C4→C5 progress (100 → 0 of 100 into The Ascent)', () => {
    const nodes = journeyNodes(100);
    const ascent = nodes[4]!;
    expect(ascent.state).toBe('current');
    expect(ascent.fraction).toBe(0);
    expect(ascent.meta).toBe('0 of 100 quests to the next chapter');
  });

  it('fills completed chapters and locks the future ones at any count', () => {
    const nodes = journeyNodes(600);
    expect(nodes.map((node) => node.state)).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
      'current',
    ]);
    for (const node of nodes.slice(0, 6)) {
      expect(node.fraction).toBe(1);
    }
    expect(nodes[6]!.fraction).toBe(1); // peak is unbounded → FULL bar
    expect(nodes[6]!.meta).toMatch(/writes your own record/);
  });

  it('clamps negative inputs to the zero-quest mapping', () => {
    expect(journeyNodes(-3)).toEqual(journeyNodes(0));
  });
});

describe('FR-JOURNEY-6 — chapter-unlock banner lives in the Victory screen', () => {
  it('keeps the "Chapter N — you moved up!" moment (S6-01), untouched (no duplicate)', () => {
    const source = readFileSync(VICTORY_JOURNEY_SOURCE, 'utf8');
    expect(source).toContain('movedChapter');
    expect(source).toContain('you moved up!');
  });
});

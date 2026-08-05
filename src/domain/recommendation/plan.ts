import type { OnboardingAnswers } from './types';

export const STARTING_DIFFICULTY_LINE = 'Easy — your first 7 quests are gentle by design.';

export const RHYTHM_LINE = '3–5 quests a week — rest days are yours.';

export const TONE_BANNED_WORDS = ['intense', 'painful', 'grind', 'suffer'];

const FOCUS_MAP: Record<string, string[]> = {
  build_a_habit: ['discipline', 'mobility'],
  get_stronger: ['strength'],
  more_energy: ['endurance'],
  feel_better: ['mobility'],
  move_easier: ['mobility'],
};

const FOCUS_DISPLAY: Record<string, string> = {
  discipline: 'Discipline',
  endurance: 'Endurance',
  mobility: 'Mobility',
  strength: 'Strength',
};

/**
 * FR-PLAN-2 — a friendly summary of the plan shape, built purely from the
 * onboarding answers. No game math lives in the client component.
 */
export function planSummary(onboarding: OnboardingAnswers): {
  focusAreas: string[];
  startingDifficulty: string;
  rhythm: string;
} {
  const focusAreas = new Set<string>();
  for (const goal of onboarding.goals) {
    const mapped = FOCUS_MAP[goal] ?? [];
    for (const area of mapped) {
      focusAreas.add(area);
    }
  }
  if (focusAreas.size === 0) {
    focusAreas.add('mobility');
    focusAreas.add('discipline');
  }

  return {
    focusAreas: Array.from(focusAreas),
    startingDifficulty: STARTING_DIFFICULTY_LINE,
    rhythm: RHYTHM_LINE,
  };
}

/**
 * FR-PLAN-2 display copy — formatted for the completion screen.
 */
export function planSummaryLines(onboarding: OnboardingAnswers): {
  heading: string;
  focusLine: string;
  difficultyLine: string;
  rhythmLine: string;
} {
  const summary = planSummary(onboarding);
  return {
    heading: 'Your plan is ready.',
    focusLine: `Focus: ${summary.focusAreas.map((area) => FOCUS_DISPLAY[area] ?? area).join(' · ')}`,
    difficultyLine: summary.startingDifficulty,
    rhythmLine: summary.rhythm,
  };
}

/**
 * AT-02E — client-side exercise difficulty classification for the quest-detail
 * segment rows. Purely display: no DB column backs it, and an unknown slug
 * yields null so a future catalog addition simply renders without a label.
 */
export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export const EXERCISE_DIFFICULTY: Readonly<Record<string, ExerciseDifficulty>> = {
  // Gentle, low-skill foundations.
  'wall-push-up': 'beginner',
  'step-touch': 'beginner',
  'march-in-place': 'beginner',
  'seated-march': 'beginner',
  'neck-shoulder-rolls': 'beginner',
  'cat-cow': 'beginner',
  'seated-hamstring-stretch': 'beginner',
  'standing-quad-stretch': 'beginner',
  'gentle-hops': 'beginner',
  'glute-bridge': 'beginner',
  'seated-leg-raise': 'beginner',
  'bird-dog': 'beginner',
  'wall-sit': 'beginner',

  // Loaded or balance-demanding staples.
  squat: 'intermediate',
  'push-up': 'intermediate',
  lunges: 'intermediate',
  plank: 'intermediate',

  // High-output power moves.
  'mountain-climber': 'advanced',
  'bicycle-crunch': 'advanced',
  burpees: 'advanced',
};

const DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function exerciseDifficulty(slug: string | null): ExerciseDifficulty | null {
  if (!slug) {
    return null;
  }
  return EXERCISE_DIFFICULTY[slug] ?? null;
}

/**
 * AT-02E amendment — rows show the compact difficulty ICONS instead of the
 * word (long names were squeezing the duration out). These keys feed the
 * existing DIFFICULTY_ART map in assetMap.
 */
export const DIFFICULTY_ART_KEY: Record<ExerciseDifficulty, string> = {
  beginner: 'easy',
  intermediate: 'normal',
  advanced: 'hard',
};

export function difficultyLabel(difficulty: ExerciseDifficulty): string {
  return DIFFICULTY_LABELS[difficulty];
}

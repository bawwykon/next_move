import {
  DIFFICULTY_ART_KEY,
  difficultyLabel,
  exerciseDifficulty,
  EXERCISE_DIFFICULTY,
} from '@/domain/exercises/difficulty';

describe('exercise difficulty map', () => {
  it('classifies all 20 catalog exercises exactly once', () => {
    expect(Object.keys(EXERCISE_DIFFICULTY).length).toBe(20);
  });

  it('marks the gentle foundations as beginner', () => {
    const beginners = [
      'wall-push-up',
      'step-touch',
      'march-in-place',
      'seated-march',
      'neck-shoulder-rolls',
      'cat-cow',
      'seated-hamstring-stretch',
      'standing-quad-stretch',
      'gentle-hops',
      'glute-bridge',
      'seated-leg-raise',
      'bird-dog',
      'wall-sit',
    ];
    for (const slug of beginners) {
      expect(exerciseDifficulty(slug)).toBe('beginner');
    }
  });

  it('marks the loaded staples as intermediate', () => {
    expect(exerciseDifficulty('squat')).toBe('intermediate');
    expect(exerciseDifficulty('push-up')).toBe('intermediate');
    expect(exerciseDifficulty('lunges')).toBe('intermediate');
    expect(exerciseDifficulty('plank')).toBe('intermediate');
  });

  it('marks the power moves as advanced', () => {
    expect(exerciseDifficulty('mountain-climber')).toBe('advanced');
    expect(exerciseDifficulty('bicycle-crunch')).toBe('advanced');
    expect(exerciseDifficulty('burpees')).toBe('advanced');
  });

  it('returns null for unknown slugs and missing slugs', () => {
    expect(exerciseDifficulty('dragon-flag')).toBeNull();
    expect(exerciseDifficulty(null)).toBeNull();
    expect(exerciseDifficulty('')).toBeNull();
  });

  it('labels difficulties in title case', () => {
    expect(difficultyLabel('beginner')).toBe('Beginner');
    expect(difficultyLabel('intermediate')).toBe('Intermediate');
    expect(difficultyLabel('advanced')).toBe('Advanced');
  });

  it('maps every tier to an existing difficulty art key', () => {
    expect(DIFFICULTY_ART_KEY.beginner).toBe('easy');
    expect(DIFFICULTY_ART_KEY.intermediate).toBe('normal');
    expect(DIFFICULTY_ART_KEY.advanced).toBe('hard');
  });
});

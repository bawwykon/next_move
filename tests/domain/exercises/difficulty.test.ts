import {
  DIFFICULTY_ART_KEY,
  exerciseDifficulty,
  EXERCISE_DIFFICULTY,
} from '@/domain/exercises/difficulty';

describe('exercise difficulty map', () => {
  it('classifies all 22 catalog exercises exactly once', () => {
    expect(Object.keys(EXERCISE_DIFFICULTY).length).toBe(22);
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
      'glute-bridge',
      'seated-leg-raise',
      'bird-dog',
      'superman',
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
    expect(exerciseDifficulty('side-lunge')).toBe('intermediate');
    expect(exerciseDifficulty('gentle-hops')).toBe('intermediate');
    // TUNE-01 — isometric hold reclassified (mirrors migration 0028).
    expect(exerciseDifficulty('wall-sit')).toBe('intermediate');
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

  it('maps every tier to an existing difficulty art key', () => {
    expect(DIFFICULTY_ART_KEY.beginner).toBe('easy');
    expect(DIFFICULTY_ART_KEY.intermediate).toBe('normal');
    expect(DIFFICULTY_ART_KEY.advanced).toBe('hard');
  });
});

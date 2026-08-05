import { ONBOARDING_STEPS, SKIP_DEFAULTS, optionLabel } from '../../src/features/onboarding/steps';
import {
  advance,
  canAdvance,
  completedAnswers,
  goBack,
  initialWizardState,
  selectAnswer,
  skipCurrent,
} from '../../src/features/onboarding/wizardController';

const LAST_STEP_INDEX = ONBOARDING_STEPS.length - 1;

function reachStep(state: ReturnType<typeof initialWizardState>, stepIndex: number) {
  let current = state;
  for (let i = 0; i < stepIndex; i += 1) {
    current = skipCurrent(current);
  }
  return current;
}

describe('onboarding wizard controller', () => {
  it('starts on step 0 with empty answers and not done', () => {
    const state = initialWizardState();
    expect(state.stepIndex).toBe(0);
    expect(state.done).toBe(false);
    expect(state.answers).toEqual({
      activity_level: null,
      experience: null,
      goals: [],
      workout_time: null,
    });
  });

  it('defines the 4 PRD steps with 3/4/5/4 options and curated goals', () => {
    expect(ONBOARDING_STEPS.map((step) => step.key)).toEqual([
      'activity_level',
      'experience',
      'goals',
      'workout_time',
    ]);
    expect(ONBOARDING_STEPS[0]!.options).toHaveLength(3);
    expect(ONBOARDING_STEPS[1]!.options).toHaveLength(4);
    expect(ONBOARDING_STEPS[2]!.options).toHaveLength(5);
    expect(ONBOARDING_STEPS[2]!.multi).toBe(true);
    expect(ONBOARDING_STEPS[3]!.options).toHaveLength(4);
    expect(ONBOARDING_STEPS[2]!.options.map((option) => option.value)).toEqual([
      'build_a_habit',
      'get_stronger',
      'more_energy',
      'feel_better',
      'move_easier',
    ]);
    expect(SKIP_DEFAULTS).toEqual({
      activity_level: 2,
      experience: 2,
      goals: [],
      workout_time: 'any',
    });
  });

  it('cannot advance until the current step is answered', () => {
    const empty = initialWizardState();
    expect(canAdvance(empty)).toBe(false);
    const answered = selectAnswer(empty, 1);
    expect(canAdvance(answered)).toBe(true);
  });

  it('stores a single-select answer and preserves the others', () => {
    const answered = selectAnswer(initialWizardState(), 2);
    expect(answered.answers.activity_level).toBe(2);
    expect(answered.answers.experience).toBeNull();
    const withExperience = selectAnswer(advance(answered), 4);
    expect(withExperience.answers.activity_level).toBe(2);
    expect(withExperience.answers.experience).toBe(4);
  });

  it('toggles goals as a multi-select', () => {
    let state = reachStep(initialWizardState(), 2);
    state = selectAnswer(state, 'build_a_habit');
    state = selectAnswer(state, 'more_energy');
    expect(state.answers.goals).toEqual(['build_a_habit', 'more_energy']);
    state = selectAnswer(state, 'build_a_habit');
    expect(state.answers.goals).toEqual(['more_energy']);
  });

  it('goes back one step and clamps at step 0', () => {
    let state = reachStep(initialWizardState(), 2);
    expect(state.stepIndex).toBe(2);
    state = goBack(state);
    expect(state.stepIndex).toBe(1);
    state = goBack(state);
    state = goBack(state);
    expect(state.stepIndex).toBe(0);
  });

  it('advances step by step and completes on the last step', () => {
    let state = reachStep(initialWizardState(), LAST_STEP_INDEX);
    expect(state.done).toBe(false);
    state = advance(state);
    expect(state.done).toBe(true);
  });

  it('skip applies the safe default for the current step and advances', () => {
    let state = reachStep(initialWizardState(), 1);
    state = skipCurrent(state);
    expect(state.answers.experience).toBe(2);
    expect(state.stepIndex).toBe(2);
    state = skipCurrent(state);
    expect(state.answers.goals).toEqual([]);
    expect(state.stepIndex).toBe(3);
    state = skipCurrent(state);
    expect(state.answers.workout_time).toBe('any');
    expect(state.done).toBe(true);
  });

  it('skip does not overwrite an existing answer', () => {
    let state = reachStep(initialWizardState(), 0);
    state = selectAnswer(state, 3);
    state = skipCurrent(state);
    expect(state.answers.activity_level).toBe(3);
  });

  it('completedAnswers builds the payload from full answers', () => {
    let state = initialWizardState();
    state = selectAnswer(state, 3);
    state = advance(state);
    state = selectAnswer(state, 4);
    state = advance(state);
    state = selectAnswer(state, 'get_stronger');
    state = selectAnswer(state, 'feel_better');
    state = advance(state);
    state = selectAnswer(state, 'evening');
    expect(completedAnswers(state)).toEqual({
      activity_level: 3,
      experience: 4,
      goals: ['get_stronger', 'feel_better'],
      workout_time: 'evening',
    });
  });

  it('completedAnswers falls back to defaults for anything unanswered', () => {
    const state = initialWizardState();
    expect(completedAnswers(state)).toEqual({
      activity_level: 2,
      experience: 2,
      goals: [],
      workout_time: 'any',
    });
  });

  it('completedAnswers fills only the missing keys with defaults', () => {
    let state = reachStep(initialWizardState(), 2);
    state = selectAnswer(state, 'move_easier');
    expect(completedAnswers(state)).toEqual({
      activity_level: 2,
      experience: 2,
      goals: ['move_easier'],
      workout_time: 'any',
    });
  });

  it('optionLabel resolves friendly copy for stored values', () => {
    expect(optionLabel('activity_level', 2)).toBe('Some movement');
    expect(optionLabel('experience', 4)).toBe('Regularly');
    expect(optionLabel('goals', 'more_energy')).toBe('More energy');
    expect(optionLabel('workout_time', 'any')).toBe('Any time');
    expect(optionLabel('workout_time', 99)).toBe('99');
  });
});

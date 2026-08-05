import {
  ONBOARDING_STEPS,
  SKIP_DEFAULTS,
  type Goal,
  type StepKey,
  type WorkoutTime,
} from './steps';

export interface WizardAnswers {
  activity_level: number | null;
  experience: number | null;
  goals: Goal[];
  workout_time: WorkoutTime | null;
}

export interface WizardState {
  stepIndex: number;
  answers: WizardAnswers;
  done: boolean;
}

export interface OnboardingPayload {
  activity_level: number;
  experience: number;
  goals: Goal[];
  workout_time: WorkoutTime;
}

export function initialWizardState(): WizardState {
  return {
    stepIndex: 0,
    answers: {
      activity_level: null,
      experience: null,
      goals: [],
      workout_time: null,
    },
    done: false,
  };
}

export function currentStepKey(state: WizardState): StepKey {
  return ONBOARDING_STEPS[state.stepIndex]!.key;
}

export function isStepAnswered(state: WizardState): boolean {
  switch (currentStepKey(state)) {
    case 'activity_level':
      return state.answers.activity_level !== null;
    case 'experience':
      return state.answers.experience !== null;
    case 'goals':
      return state.answers.goals.length > 0;
    case 'workout_time':
      return state.answers.workout_time !== null;
  }
}

export function canAdvance(state: WizardState): boolean {
  return isStepAnswered(state);
}

export function selectAnswer(state: WizardState, value: number | string): WizardState {
  const key = currentStepKey(state);
  if (key === 'goals') {
    const goal = value as Goal;
    const selected = state.answers.goals.includes(goal);
    return {
      ...state,
      answers: {
        ...state.answers,
        goals: selected
          ? state.answers.goals.filter((g) => g !== goal)
          : [...state.answers.goals, goal],
      },
    };
  }
  if (key === 'activity_level') {
    return { ...state, answers: { ...state.answers, activity_level: Number(value) } };
  }
  if (key === 'experience') {
    return { ...state, answers: { ...state.answers, experience: Number(value) } };
  }
  return { ...state, answers: { ...state.answers, workout_time: value as WorkoutTime } };
}

export function goBack(state: WizardState): WizardState {
  if (state.stepIndex === 0) {
    return state;
  }
  return { ...state, stepIndex: state.stepIndex - 1 };
}

function advanceIndex(state: WizardState): WizardState {
  const lastIndex = ONBOARDING_STEPS.length - 1;
  if (state.stepIndex >= lastIndex) {
    return { ...state, done: true };
  }
  return { ...state, stepIndex: state.stepIndex + 1 };
}

export function advance(state: WizardState): WizardState {
  return advanceIndex(state);
}

export function skipCurrent(state: WizardState): WizardState {
  const key = currentStepKey(state);
  const answers = { ...state.answers };
  if (key === 'activity_level' && answers.activity_level === null) {
    answers.activity_level = SKIP_DEFAULTS.activity_level;
  } else if (key === 'experience' && answers.experience === null) {
    answers.experience = SKIP_DEFAULTS.experience;
  } else if (key === 'goals' && answers.goals.length === 0) {
    answers.goals = [...SKIP_DEFAULTS.goals];
  } else if (key === 'workout_time' && answers.workout_time === null) {
    answers.workout_time = SKIP_DEFAULTS.workout_time;
  }
  return advanceIndex({ ...state, answers });
}

export function completedAnswers(state: WizardState): OnboardingPayload {
  return {
    activity_level: state.answers.activity_level ?? SKIP_DEFAULTS.activity_level,
    experience: state.answers.experience ?? SKIP_DEFAULTS.experience,
    goals: state.answers.goals.length > 0 ? state.answers.goals : [...SKIP_DEFAULTS.goals],
    workout_time: state.answers.workout_time ?? SKIP_DEFAULTS.workout_time,
  };
}

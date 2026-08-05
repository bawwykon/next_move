export type StepKey = 'activity_level' | 'experience' | 'goals' | 'workout_time';

export type Goal = 'build_a_habit' | 'get_stronger' | 'more_energy' | 'feel_better' | 'move_easier';

export type WorkoutTime = 'morning' | 'afternoon' | 'evening' | 'any';

export interface OnboardingOption {
  value: number | string;
  label: string;
  hint?: string;
}

export interface OnboardingStep {
  key: StepKey;
  title: string;
  subtitle?: string;
  multi?: boolean;
  options: OnboardingOption[];
}

export const ACTIVITY_LEVEL_OPTIONS: OnboardingOption[] = [
  { value: 1, label: 'Mostly sitting', hint: 'Desks, drives, and screens' },
  { value: 2, label: 'Some movement', hint: 'On your feet now and then' },
  { value: 3, label: 'Very active', hint: 'Moving most of the day' },
];

export const EXPERIENCE_OPTIONS: OnboardingOption[] = [
  { value: 1, label: 'Never', hint: 'Starting from zero' },
  { value: 2, label: 'Rarely', hint: 'A walk here and there' },
  { value: 3, label: 'Sometimes', hint: 'A few times a month' },
  { value: 4, label: 'Regularly', hint: 'Most weeks' },
];

export const GOAL_OPTIONS: OnboardingOption[] = [
  { value: 'build_a_habit', label: 'Build a habit' },
  { value: 'get_stronger', label: 'Get stronger' },
  { value: 'more_energy', label: 'More energy' },
  { value: 'feel_better', label: 'Feel better' },
  { value: 'move_easier', label: 'Move easier' },
];

export const WORKOUT_TIME_OPTIONS: OnboardingOption[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'any', label: 'Any time' },
];

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'activity_level',
    title: 'How active are you today?',
    subtitle: 'Be honest — your plan adapts to you.',
    options: ACTIVITY_LEVEL_OPTIONS,
  },
  {
    key: 'experience',
    title: 'How new are you to exercise?',
    options: EXPERIENCE_OPTIONS,
  },
  {
    key: 'goals',
    title: 'What matters most to you?',
    subtitle: 'Pick all that fit.',
    multi: true,
    options: GOAL_OPTIONS,
  },
  {
    key: 'workout_time',
    title: 'When do you like to move?',
    subtitle: 'We\u2019ll use this to time your quests.',
    options: WORKOUT_TIME_OPTIONS,
  },
];

// FR-ONB-4: skipping a step falls back to these safe defaults.
export const SKIP_DEFAULTS = {
  activity_level: 2,
  experience: 2,
  goals: [] as Goal[],
  workout_time: 'any' as WorkoutTime,
};

export function optionLabel(key: StepKey, value: number | string): string {
  const step = ONBOARDING_STEPS.find((s) => s.key === key);
  return step?.options.find((option) => option.value === value)?.label ?? String(value);
}

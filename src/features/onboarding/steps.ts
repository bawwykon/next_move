export type StepKey = 'activity_level' | 'experience' | 'goals' | 'workout_time' | 'display_name';

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
  {
    key: 'display_name',
    title: 'What should we call you?',
    subtitle: 'This is how you\u2019ll appear on the board. You can change it anytime.',
    options: [],
  },
];

// FR-ONB-4: skipping a step falls back to these safe defaults.
export const SKIP_DEFAULTS = {
  activity_level: 2,
  experience: 2,
  goals: [] as Goal[],
  workout_time: 'any' as WorkoutTime,
  display_name: null as string | null,
};

export function optionLabel(key: StepKey, value: number | string): string {
  const step = ONBOARDING_STEPS.find((s) => s.key === key);
  return step?.options.find((option) => option.value === value)?.label ?? String(value);
}

/**
 * I18N-01 — localized onboarding content. `ONBOARDING_STEPS` above stays as
 * the English reference (pinned by wizard tests); the UI renders
 * `localizeOnboardingSteps(t)` so every step title, option label and hint
 * follows the active locale. Pools mirror the reference 1:1 in
 * `onboarding.steps/activity/experience/goals/time`.
 */
export function localizedOptionLabel(
  key: StepKey,
  value: number | string,
  t: (k: string) => string,
): string {
  switch (key) {
    case 'activity_level':
      if (value === 1) return t('onboarding.activity.sitting.label');
      if (value === 2) return t('onboarding.activity.some.label');
      if (value === 3) return t('onboarding.activity.active.label');
      break;
    case 'experience':
      if (value === 1) return t('onboarding.experience.never.label');
      if (value === 2) return t('onboarding.experience.rarely.label');
      if (value === 3) return t('onboarding.experience.sometimes.label');
      if (value === 4) return t('onboarding.experience.regularly.label');
      break;
    case 'goals':
      if (value === 'build_a_habit') return t('onboarding.goals.habit');
      if (value === 'get_stronger') return t('onboarding.goals.stronger');
      if (value === 'more_energy') return t('onboarding.goals.energy');
      if (value === 'feel_better') return t('onboarding.goals.better');
      if (value === 'move_easier') return t('onboarding.goals.easier');
      break;
    case 'workout_time':
      if (value === 'morning') return t('onboarding.time.morning');
      if (value === 'afternoon') return t('onboarding.time.afternoon');
      if (value === 'evening') return t('onboarding.time.evening');
      if (value === 'any') return t('onboarding.time.any');
      break;
    case 'display_name':
      break;
  }
  return optionLabel(key, value);
}

function localizedOptions(key: StepKey, t: (k: string) => string): OnboardingOption[] {
  switch (key) {
    case 'activity_level':
      return [
        {
          value: 1,
          label: t('onboarding.activity.sitting.label'),
          hint: t('onboarding.activity.sitting.hint'),
        },
        {
          value: 2,
          label: t('onboarding.activity.some.label'),
          hint: t('onboarding.activity.some.hint'),
        },
        {
          value: 3,
          label: t('onboarding.activity.active.label'),
          hint: t('onboarding.activity.active.hint'),
        },
      ];
    case 'experience':
      return (['never', 'rarely', 'sometimes', 'regularly'] as const).map((k, i) => ({
        value: i + 1,
        label: t(`onboarding.experience.${k}.label`),
        hint: t(`onboarding.experience.${k}.hint`),
      }));
    case 'goals':
      return (
        [
          ['build_a_habit', 'habit'],
          ['get_stronger', 'stronger'],
          ['more_energy', 'energy'],
          ['feel_better', 'better'],
          ['move_easier', 'easier'],
        ] as const
      ).map(([value, k]) => ({ value, label: t(`onboarding.goals.${k}`) }));
    case 'workout_time':
      return (['morning', 'afternoon', 'evening', 'any'] as const).map((k) => ({
        value: k,
        label: t(`onboarding.time.${k}`),
      }));
    case 'display_name':
      return [];
  }
}

export function localizeOnboardingSteps(t: (k: string) => string): OnboardingStep[] {
  return ONBOARDING_STEPS.map((step) => ({
    key: step.key,
    title: t(`onboarding.steps.${step.key}.title`),
    subtitle: step.subtitle ? (t(`onboarding.steps.${step.key}.subtitle`) as string) : undefined,
    multi: step.multi,
    options: localizedOptions(step.key, t),
  }));
}

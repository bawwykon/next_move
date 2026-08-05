import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import {
  ONBOARDING_STEPS,
  optionLabel,
  type Goal,
  type OnboardingOption,
} from '@/features/onboarding/steps';
import {
  advance,
  canAdvance,
  completedAnswers,
  goBack,
  initialWizardState,
  selectAnswer,
  skipCurrent,
  type WizardState,
} from '@/features/onboarding/wizardController';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

const STEP_COUNT = ONBOARDING_STEPS.length;

export default function OnboardingScreen() {
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = ONBOARDING_STEPS[wizard.stepIndex]!;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (wizard.stepIndex > 0 && !wizard.done) {
        setWizard((current) => goBack(current));
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [wizard.stepIndex, wizard.done]);

  const isSelected = (option: OnboardingOption): boolean => {
    if (step.key === 'goals') {
      return wizard.answers.goals.includes(option.value as Goal);
    }
    return wizard.answers[step.key] === option.value;
  };

  const handleAdvance = () => {
    setError(null);
    setWizard((current) => advance(current));
  };

  const handleSkip = () => {
    setError(null);
    setWizard((current) => skipCurrent(current));
  };

  const handleComplete = async () => {
    setSaving(true);
    setError(null);
    const message = await completeOnboarding(completedAnswers(wizard));
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace('/(tabs)/quest-board');
  };

  if (wizard.done) {
    const payload = completedAnswers(wizard);
    return (
      <Screen>
        <View style={styles.hero}>
          <Text style={styles.title}>Your plan is ready</Text>
          <Text style={styles.body}>
            {
              "We've set your starting plan around these answers. Your personalized quests arrive soon."
            }
          </Text>
          <View style={styles.echo}>
            <Text style={styles.echoLine}>
              <Text style={styles.echoKey}>Activity:</Text>{' '}
              {optionLabel('activity_level', payload.activity_level)}
            </Text>
            <Text style={styles.echoLine}>
              <Text style={styles.echoKey}>Experience:</Text>{' '}
              {optionLabel('experience', payload.experience)}
            </Text>
            <Text style={styles.echoLine}>
              <Text style={styles.echoKey}>Goals:</Text>{' '}
              {payload.goals.length > 0
                ? payload.goals.map((goal) => optionLabel('goals', goal)).join(', ')
                : 'A fresh start'}
            </Text>
            <Text style={styles.echoLine}>
              <Text style={styles.echoKey}>Preferred time:</Text>{' '}
              {optionLabel('workout_time', payload.workout_time)}
            </Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton label="Go to my quest board" onPress={handleComplete} loading={saving} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View
          style={styles.dots}
          accessibilityLabel={`Step ${wizard.stepIndex + 1} of ${STEP_COUNT}`}
        >
          {ONBOARDING_STEPS.map((item, index) => (
            <View
              key={item.key}
              style={[styles.dot, index <= wizard.stepIndex && styles.dotActive]}
            />
          ))}
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>{step.title}</Text>
          {step.subtitle ? <Text style={styles.subtitle}>{step.subtitle}</Text> : null}
        </View>
        <View style={styles.options}>
          {step.options.map((option) => {
            const selected = isSelected(option);
            return (
              <Pressable
                key={String(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => setWizard((current) => selectAnswer(current, option.value))}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
                {option.hint ? (
                  <Text style={[styles.optionHint, selected && styles.optionHintSelected]}>
                    {option.hint}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.actions}>
          <AppButton
            label={wizard.stepIndex === STEP_COUNT - 1 ? 'Finish' : 'Next'}
            onPress={handleAdvance}
            disabled={!canAdvance(wizard)}
          />
          {wizard.stepIndex > 0 ? (
            <AppButton
              label="Back"
              variant="secondary"
              onPress={() => setWizard((c) => goBack(c))}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not sure yet — skip"
            onPress={handleSkip}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Not sure yet — skip</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  dotActive: {
    backgroundColor: colors.reward,
  },
  header: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 32,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 16,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  option: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.reward,
    borderColor: colors.reward,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
  },
  optionLabelSelected: {
    color: colors.background,
  },
  optionHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  optionHintSelected: {
    color: colors.background,
    opacity: 0.75,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  skip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 16,
    lineHeight: 24,
  },
  echo: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginVertical: spacing.xl,
  },
  echoLine: {
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 15,
  },
  echoKey: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
});

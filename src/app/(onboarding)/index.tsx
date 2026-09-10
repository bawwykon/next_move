import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { onboardingArt } from '@/features/assets/assetMap';
import { CharacterSummaryScreen } from '@/features/onboarding/CharacterSummaryScreen';
import { withTapCue } from '@/lib/sounds';
import { ONBOARDING_STEPS, type Goal, type OnboardingOption } from '@/features/onboarding/steps';
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
const NAME_MAX = 16;

export default function OnboardingScreen() {
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // PH3-01 — text input for the display_name step (optional, default 'Adventurer').
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<TextInput>(null);

  const step = ONBOARDING_STEPS[wizard.stepIndex]!;
  // AT-01D — one hero illustration per onboarding step (assets/onboarding/).
  const hero = onboardingArt(wizard.stepIndex + 1);

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
    // PH3-01 — capture the text input value before advancing.
    if (step.key === 'display_name') {
      const trimmed = nameDraft.trim();
      setWizard((current) => ({
        ...current,
        answers: { ...current.answers, display_name: trimmed || null },
      }));
    }
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
    return (
      <CharacterSummaryScreen
        payload={completedAnswers(wizard)}
        saving={saving}
        error={error}
        onClaim={handleComplete}
        onEdit={() => setWizard(initialWizardState())}
      />
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          {hero !== null ? (
            <Image source={hero} style={styles.heroImage} contentFit="contain" />
          ) : null}
          <Text style={styles.title}>{step.title}</Text>
          {step.subtitle ? <Text style={styles.subtitle}>{step.subtitle}</Text> : null}
        </View>
        <View style={styles.options}>
          {step.options.length === 0 ? (
            // PH3-01 — text input variant for the display_name step.
            <View style={styles.nameInputWrap}>
              <TextInput
                ref={nameInputRef}
                value={nameDraft}
                onChangeText={(text) => setNameDraft(text.slice(0, NAME_MAX))}
                placeholder="Adventurer"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                maxLength={NAME_MAX}
                style={styles.nameInput}
                onFocus={() => {
                  if (!nameDraft) {
                    setNameDraft(wizard.answers.display_name ?? '');
                  }
                }}
              />
              <Text style={styles.nameHint}>
                Leave blank for &quot;Adventurer&quot; — you can change this anytime.
              </Text>
            </View>
          ) : (
            step.options.map((option) => {
              const selected = isSelected(option);
              return (
                <Pressable
                  key={String(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  onPress={withTapCue(() => {
                    setWizard((current) => selectAnswer(current, option.value));
                  })}
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
            })
          )}
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
            onPress={withTapCue(handleSkip)}
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
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    flexGrow: 1,
    width: '100%',
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
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    // AT-01E/AT-01Q — the tile sits behind the onboarding art; its color is
    // the app background (#1A1712) so the transparent art reads flush with
    // the screen, no visible rectangle.
    backgroundColor: colors.background,
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
  nameInputWrap: {
    gap: spacing.sm,
  },
  nameInput: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  nameHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
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
});

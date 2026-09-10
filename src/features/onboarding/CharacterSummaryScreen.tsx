import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { planSummary } from '@/domain/recommendation/plan';
import { cosmeticArt, masteryArt } from '@/features/assets/assetMap';
import { optionLabel } from '@/features/onboarding/steps';
import type { OnboardingPayload } from '@/features/onboarding/wizardController';
import { withTapCue } from '@/lib/sounds';
import { colors, fonts, radius, spacing } from '@/lib/theme';

const CALIBRATION_MS = 1500;

const TRACK_LABEL: Record<string, string> = {
  strength: 'Strength',
  endurance: 'Endurance',
  mobility: 'Mobility',
  discipline: 'Discipline',
};

const MASTERY_TRACKS = ['strength', 'endurance', 'mobility', 'discipline'] as const;

interface CharacterSummaryScreenProps {
  payload: OnboardingPayload;
  saving: boolean;
  error: string | null;
  onClaim: () => void;
  onEdit: () => void;
}

/**
 * ONBOARDING-PAYOFF — the Adventurer Character Sheet shown after Step 5.
 * Opens with a brief calibration loader, then renders the payoff card:
 * avatar, identity, schedule/focus pills, baseline mastery preview, and
 * the claim CTA. Reuses the existing onboarding payload only — no DB writes
 * happen here; the parent owns `completeOnboarding`.
 */
export function CharacterSummaryScreen({
  payload,
  saving,
  error,
  onClaim,
  onEdit,
}: CharacterSummaryScreenProps) {
  const [calibrating, setCalibrating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setCalibrating(false), CALIBRATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (calibrating) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.reward} />
          <Text style={styles.loaderTitle}>Setting up your daily quest board...</Text>
          <Text style={styles.loaderSubtitle}>Forging your Adventurer Profile...</Text>
        </View>
      </Screen>
    );
  }

  const displayName =
    payload.display_name && payload.display_name.trim() ? payload.display_name : 'Adventurer';
  const focusAreas = planSummary(payload).focusAreas;
  const focusSet = new Set(focusAreas);
  const focusLabels = focusAreas.map((area) => TRACK_LABEL[area] ?? area);
  const scheduleLabel =
    payload.workout_time === 'any'
      ? 'Any Time'
      : `${optionLabel('workout_time', payload.workout_time)} Quests`;
  const portrait = cosmeticArt('portrait-default');
  const frame = cosmeticArt('frame-default');

  return (
    <Screen>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {portrait !== null ? (
              <Image
                source={portrait}
                style={styles.avatarImage}
                contentFit="cover"
                accessibilityLabel="Character portrait"
              />
            ) : (
              <Text style={styles.initials}>{displayName.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          {frame !== null ? (
            <Image
              source={frame}
              style={styles.avatarFrame}
              contentFit="contain"
              pointerEvents="none"
              accessibilityLabel="Frame"
            />
          ) : null}
        </View>

        <Text style={styles.headline}>Your Adventurer Profile is Ready!</Text>

        <View style={styles.identity}>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>Level 1 • Novice Adventurer</Text>
          </View>
        </View>

        <View style={styles.pills}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{scheduleLabel}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Focus: {focusLabels.join(' & ')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mastery</Text>
          <View style={styles.masteryList}>
            {MASTERY_TRACKS.map((track) => {
              const icon = masteryArt(track);
              const isFocus = focusSet.has(track);
              return (
                <View key={track} style={styles.masteryRow}>
                  <View style={styles.masteryLabelRow}>
                    {icon !== null ? (
                      <Image source={icon} style={styles.masteryIcon} contentFit="contain" />
                    ) : null}
                    <Text style={styles.masteryLabel}>{TRACK_LABEL[track] ?? track}</Text>
                    {isFocus ? (
                      <View style={styles.focusBadge}>
                        <Text style={styles.focusBadgeText}>Primary Focus</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.masteryLevel}>Lv 1 • Novice (0 / 100 XP)</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: '0%' }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton label="Claim Profile & Start Quest" onPress={onClaim} loading={saving} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit answers"
          onPress={withTapCue(onEdit)}
          style={styles.editLink}
        >
          <Text style={styles.editLinkText}>Edit answers</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loaderTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 20,
    textAlign: 'center',
  },
  loaderSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  avatarWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 36,
  },
  avatarFrame: {
    position: 'absolute',
    width: 229.5,
    height: 229.5,
    zIndex: 2,
  },
  headline: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 24,
    textAlign: 'center',
  },
  identity: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 24,
    textAlign: 'center',
  },
  rankBadge: {
    borderWidth: 1,
    borderColor: colors.reward,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  rankText: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pill: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillText: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  masteryList: {
    gap: spacing.md,
  },
  masteryRow: {
    gap: spacing.xs,
  },
  masteryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  masteryIcon: {
    width: 30,
    height: 30,
  },
  masteryLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  focusBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  focusBadgeText: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  masteryLevel: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  barTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.body.family,
    fontSize: 14,
    textAlign: 'center',
  },
  editLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLinkText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Screen } from '@/components/ui/Screen';
import {
  deleteCustomWorkout,
  fetchCustomWorkout,
  fetchExerciseCatalog,
  type CatalogExercise,
} from '@/data/repositories/customWorkouts';
import {
  DEFAULT_WORKOUT_NAME,
  projectedXp,
  totalDurationSec,
  zoneForXp,
  type MeterZone,
} from '@/domain/customWorkout/model';
import { DIFFICULTY_ART_KEY, difficultyLabel } from '@/domain/exercises/difficulty';
import type { QuestDifficulty } from '@/domain/recommendation/types';
import { difficultyArt, exerciseArt } from '@/features/assets/assetMap';
import { DIFFICULTY_DESCRIPTORS, difficultyBadge } from '@/features/questBoard/badges';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { withTapCue } from '@/lib/sounds';

/**
 * BYQ-04 — detail screen for a saved custom quest. Mirrors the quest-detail
 * layout (title, zone badge, meta line, segment rows) and adds the custom-only
 * actions: Start (straight into the workout), Edit (builder in edit mode), and
 * Delete behind its one allowed confirmation sheet.
 */
export default function CustomQuestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const workoutId = params.id;

  const [catalog, setCatalog] = useState<CatalogExercise[] | null>(null);
  const [workout, setWorkout] =
    useState<Awaited<ReturnType<typeof fetchCustomWorkout>>['data']>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!workoutId) {
      setStatus('error');
      return;
    }
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const [customResult, catalogResult] = await Promise.all([
      fetchCustomWorkout(workoutId),
      fetchExerciseCatalog(),
    ]);
    if (customResult.error || !customResult.data) {
      setStatus('error');
      return;
    }
    setWorkout(customResult.data);
    setCatalog(catalogResult.data ?? []);
    setStatus('ready');
  }, [workoutId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const difficultyOf = useCallback(
    (slug: string) => catalog?.find((exercise) => exercise.slug === slug)?.difficulty ?? null,
    [catalog],
  );
  const nameOf = useCallback(
    (slug: string) => catalog?.find((exercise) => exercise.slug === slug)?.name ?? slug,
    [catalog],
  );

  const onDelete = async () => {
    if (!workoutId || deleting) {
      return;
    }
    setDeleting(true);
    const result = await deleteCustomWorkout(workoutId);
    setDeleting(false);
    if (result.error === null) {
      setDeleteVisible(false);
      router.back();
    }
  };

  if (status === 'idle' || (status === 'loading' && !workout)) {
    return (
      <Screen>
        <SkeletonPulse />
      </Screen>
    );
  }

  if (status === 'error' || !workout || !catalog) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>This quest is hiding.</Text>
          <Text style={styles.errorLine}>Could not load its details. Try again in a moment.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={withTapCue(() => {
              setStatus('loading');
              void load();
            })}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const title = workout.name || DEFAULT_WORKOUT_NAME;
  // The zone badge reuses the catalog tiers' friendly labels/colors — the
  // projection is display-only, exactly like the builder's meter. The pill
  // shows BYQ-04b's verbatim descriptor with the zone word.
  const zone: MeterZone = zoneForXp(projectedXp(workout.segments, difficultyOf));
  const badge = difficultyBadge(zone as QuestDifficulty);
  const descriptor = DIFFICULTY_DESCRIPTORS[zone as QuestDifficulty];
  const totalSec = totalDurationSec(workout.segments);

  return (
    <Screen>
      <View style={styles.screen}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={withTapCue(() => router.back())}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        {/* BYQ-04b — the content scrolls; only the CTA footer stays fixed. */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <View style={[styles.badge, { backgroundColor: badge.color }]}>
              <Text style={styles.badgeLabel}>{descriptor}</Text>
            </View>
            <Text style={styles.meta}>
              {Math.round(totalSec / 60)} min · +{projectedXp(workout.segments, difficultyOf)} XP{' '}
              (projected)
            </Text>
            <Text style={styles.description}>
              Your own mix — {workout.segments.length} exercise
              {workout.segments.length === 1 ? '' : 's'} in your order.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Quest</Text>
            {workout.segments.map((segment, index) => {
              const thumb = exerciseArt(segment.exerciseSlug);
              const diff = difficultyOf(segment.exerciseSlug);
              const icon = diff !== null ? difficultyArt(DIFFICULTY_ART_KEY[diff]) : null;
              return (
                <View key={`${segment.exerciseSlug}-${index}`} style={styles.segmentRow}>
                  {thumb !== null ? (
                    <Image source={thumb} style={styles.segmentThumb} contentFit="contain" />
                  ) : null}
                  <Text style={styles.segmentName} numberOfLines={1}>
                    {nameOf(segment.exerciseSlug)}
                  </Text>
                  {icon !== null ? (
                    <Image
                      source={icon}
                      style={styles.diffIcon}
                      contentFit="contain"
                      accessibilityLabel={
                        diff !== null ? `${difficultyLabel(diff)} difficulty` : undefined
                      }
                    />
                  ) : null}
                  <Text style={styles.segmentDuration}>{segment.durationSec}s</Text>
                </View>
              );
            })}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, '0')}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.startButton}
            onPress={withTapCue(() =>
              router.push({
                pathname: '/workout/[id]',
                params: { id: workout.id, title, source: 'custom' },
              }),
            )}
          >
            <Text style={styles.startLabel}>Start</Text>
            <Ionicons name="play" size={20} color={colors.background} />
          </TouchableOpacity>
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={withTapCue(() =>
                router.push({ pathname: '/build', params: { id: workout.id } }),
              )}
            >
              <Ionicons name="create-outline" size={18} color={colors.calmStrong} />
              <Text style={styles.secondaryLabel}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.secondaryButton, styles.deleteButton]}
              onPress={withTapCue(() => setDeleteVisible(true))}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.secondaryLabel, styles.deleteLabel]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={deleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Delete “{title}”?</Text>
            <Text style={styles.sheetBody}>
              Past completions keep their XP — only the recipe is removed.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.sheetDelete}
              disabled={deleting}
              onPress={withTapCue(() => void onDelete())}
            >
              <Text style={styles.sheetDeleteLabel}>{deleting ? 'Deleting…' : 'Delete'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.sheetCancel}
              onPress={withTapCue(() => setDeleteVisible(false))}
            >
              <Text style={styles.sheetCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SkeletonPulse() {
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.skeletonWrap}>
      <Animated.View style={[styles.skeletonTitle, { opacity }]} />
      <Animated.View style={[styles.skeletonLine, { opacity }]} />
      <Animated.View style={[styles.skeletonRow, { opacity }]} />
      <Animated.View style={[styles.skeletonRow, { opacity }]} />
      <Animated.View style={[styles.skeletonRow, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    marginBottom: spacing.md,
  },
  backLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 28,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeLabel: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
  },
  meta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
  description: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    lineHeight: 21,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 18,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
    gap: spacing.md,
  },
  segmentThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  segmentName: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 15,
  },
  diffIcon: {
    width: 20,
    height: 20,
  },
  segmentDuration: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    minWidth: 34,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  totalLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  totalValue: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 16,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceElevated,
    gap: spacing.md,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.reward,
  },
  startLabel: {
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 18,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
  },
  secondaryLabel: {
    color: colors.calmStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  deleteButton: {
    borderColor: colors.danger,
  },
  deleteLabel: {
    color: colors.danger,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  errorTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 22,
    textAlign: 'center',
  },
  errorLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 20,
    textAlign: 'center',
  },
  sheetBody: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  sheetDelete: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  sheetDeleteLabel: {
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 17,
  },
  sheetCancel: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  skeletonWrap: {
    gap: spacing.md,
    flex: 1,
  },
  skeletonTitle: {
    height: 34,
    width: '60%',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonLine: {
    height: 16,
    width: '40%',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonRow: {
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
});

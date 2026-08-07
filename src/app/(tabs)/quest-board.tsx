import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { getOnboarding } from '@/data/repositories/profile';
import { fetchActiveQuests, type ActiveQuest } from '@/data/repositories/quests';
import { supabase } from '@/data/supabase';
import { alternatives, recommendQuest } from '@/domain/recommendation/recommendQuest';
import type {
  CompletionRecord,
  MasterySummary,
  OnboardingAnswers,
  QuestCategory,
  QuestDifficulty,
} from '@/domain/recommendation/types';
import { dayKey } from '@/domain/streak/dayKey';
import { difficultyBadge } from '@/features/questBoard/badges';
import { isCompletedToday } from '@/features/questBoard/completedToday';
import { formatDuration } from '@/features/questBoard/format';
import { greetingForHour } from '@/features/questBoard/greeting';
import { weeklyChallengeProgress } from '@/features/questBoard/weekly';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useCharacterStore } from '@/state/characterStore';
import { useWorkoutStore } from '@/state/workoutStore';
import { useCompletionStore } from '@/state/completionStore';

const CATEGORY_LABELS: Record<QuestCategory, string> = {
  strength: 'Strength',
  endurance: 'Endurance',
  mobility: 'Mobility',
  discipline: 'Focus',
};

// Ref 08 §7 — weekly challenge reward.
const WEEKLY_XP_REWARD = 500;

// recommendQuest accepts onboarding for parity with Ref 06; its rules do not
// consume it, so a fresh (unskipped) session can still get a recommendation.
const DEFAULT_ONBOARDING: OnboardingAnswers = {
  activity_level: 0,
  experience: 0,
  goals: [],
  workout_time: 'anytime',
};

export default function QuestBoardScreen() {
  const router = useRouter();
  const { profile, streak, mastery, completions, status, refresh } = useCharacterStore();
  // S4-03 — persisted checkpoint for the resume banner (FR-TIMER-7).
  const checkpoint = useWorkoutStore((state) => state.checkpoint);
  // S5-05 — undelivered completions; >0 renders the "Syncing…" marker.
  const pendingCount = useCompletionStore((state) => state.pendingCount);

  const [catalog, setCatalog] = useState<ActiveQuest[] | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [onboarding, setOnboarding] = useState<OnboardingAnswers | null>(null);

  const loadContent = useCallback(async () => {
    setCatalogStatus((current) => (current === 'ready' ? current : 'loading'));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCatalogStatus('error');
      return;
    }
    const [questsResult, onboardingAnswers] = await Promise.all([
      fetchActiveQuests(),
      getOnboarding(user.id),
    ]);
    if (questsResult.error) {
      setCatalogStatus('error');
      return;
    }
    setCatalog(questsResult.data ?? []);
    setOnboarding(onboardingAnswers);
    setCatalogStatus('ready');
  }, []);

  // Catalog is static content; refresh it alongside the snapshot on focus.
  useFocusEffect(
    useCallback(() => {
      void Promise.all([
        refresh(),
        loadContent(),
        useWorkoutStore.getState().hydrate(),
        useCompletionStore.getState().hydrate(),
      ]);
    }, [refresh, loadContent]),
  );

  const onRefresh = useCallback(() => {
    void Promise.all([
      refresh(),
      loadContent(),
      useWorkoutStore.getState().hydrate(),
      useCompletionStore.getState().hydrate(),
    ]);
  }, [refresh, loadContent]);

  const isLoading = status === 'loading' || catalogStatus === 'loading';
  const hasError = status === 'error' || catalogStatus === 'error';

  const todayKey = dayKey(new Date());

  const weekly = useMemo(
    () => weeklyChallengeProgress(completions ?? [], todayKey),
    [completions, todayKey],
  );

  const recommendation = useMemo(() => {
    if (!catalog || catalog.length === 0 || !completions) {
      return null;
    }
    const byId = new Map(catalog.map((quest) => [quest.id, quest]));

    const masterySummary: MasterySummary = {
      points: { strength: 0, endurance: 0, mobility: 0, discipline: 0 },
    };
    for (const row of mastery ?? []) {
      if (masterySummary.points[row.track] !== undefined) {
        masterySummary.points[row.track] = row.points;
      }
    }

    const records: CompletionRecord[] = completions.map((completion) => ({
      questId: completion.questId,
      category: byId.get(completion.questId)?.categories[0] ?? 'mobility',
      completedAt: completion.completedAt,
      dayKey: completion.dayKey ?? '',
    }));

    const now = new Date();
    const onboardingAnswers = onboarding ?? DEFAULT_ONBOARDING;
    const primaryId = recommendQuest(now, onboardingAnswers, masterySummary, records, catalog);
    if (!primaryId) {
      return null;
    }
    const recommended = byId.get(primaryId) ?? null;
    const picks = alternatives(primaryId, records, masterySummary, catalog)
      .map((id) => byId.get(id))
      .filter((quest): quest is ActiveQuest => quest !== undefined);
    return { recommended, picks };
  }, [catalog, completions, mastery, onboarding]);

  const openQuest = useCallback(
    (quest: ActiveQuest) => {
      router.push({
        pathname: '/quest/[id]',
        params: {
          id: quest.id,
          title: quest.title,
          durationSec: String(quest.durationSec),
          difficulty: quest.difficulty,
        },
      });
    },
    [router],
  );

  const { greeting, line } = greetingForHour(new Date().getHours());
  const displayName = profile?.displayName ?? 'Adventurer';
  const streakCount = streak?.current ?? 0;
  const streakLine =
    streakCount > 0
      ? `${streakCount} day${streakCount === 1 ? '' : 's'} strong!`
      : 'Your adventure is waiting.';

  return (
    <Screen>
      {hasError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Hmm, the board wandered off.</Text>
          <Text style={styles.errorLine}>Could not load your quests. Try again in a moment.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={onRefresh}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={onRefresh}
              tintColor={colors.rewardStrong}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {catalogStatus !== 'ready' || !catalog ? (
            <SkeletonPulse />
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.greeting}>
                  {greeting}, {displayName}.
                </Text>
                <Text style={styles.greetingLine}>{line}</Text>
                <View style={styles.pillRow}>
                  <View style={styles.streakPill}>
                    <Text style={styles.streakText}>{streakLine}</Text>
                  </View>
                  {/* S5-05 — completions are queued offline; the server
                      (never the client) computes XP/streak/mastery. */}
                  {pendingCount > 0 ? (
                    <View style={styles.syncingPill}>
                      <Ionicons name="sync" size={14} color={colors.textMuted} />
                      <Text style={styles.syncingText}>Syncing…</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* S4-03 / FR-TIMER-7 — app was killed mid-workout: the checkpoint
                  survived, so the quest can be picked up where it stopped. */}
              {checkpoint ? (
                <ResumeBanner
                  title={catalog?.find((quest) => quest.id === checkpoint.questId)?.title ?? null}
                  onResume={() => {
                    router.push({
                      pathname: '/workout/[id]',
                      params: { id: checkpoint.questId },
                    });
                  }}
                  onDismiss={() => {
                    // "Not now" — the quest stays incomplete; no partial XP.
                    void useWorkoutStore.getState().clearWorkout();
                  }}
                />
              ) : null}

              {recommendation?.recommended ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Today&apos;s Recommended Quest</Text>
                  <QuestCard
                    quest={recommendation.recommended}
                    completedToday={isCompletedToday(
                      completions ?? [],
                      recommendation.recommended.id,
                      todayKey,
                    )}
                    hero
                    onPress={() => openQuest(recommendation.recommended!)}
                  />
                </View>
              ) : null}

              {recommendation && recommendation.picks.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Choose Your Adventure</Text>
                  {recommendation.picks.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      completedToday={isCompletedToday(completions ?? [], quest.id, todayKey)}
                      onPress={() => openQuest(quest)}
                    />
                  ))}
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Weekly Challenge</Text>
                <View style={styles.weeklyCard}>
                  <Text style={styles.weeklyGoal}>Complete {weekly.target} quests this week</Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, (weekly.done / weekly.target) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.weeklyMeta}>
                    <Text style={styles.weeklyCount}>
                      {weekly.done}/{weekly.target}
                    </Text>
                    <Text style={styles.weeklyReward}>+{WEEKLY_XP_REWARD} XP</Text>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>All Quests</Text>
                {catalog.length === 0 ? (
                  <Text style={styles.quietLine}>
                    The board is a little quiet right now — new quests are on the way.
                  </Text>
                ) : (
                  catalog.map((quest) => (
                    <QuestRow
                      key={quest.id}
                      quest={quest}
                      completedToday={isCompletedToday(completions ?? [], quest.id, todayKey)}
                      onPress={() => openQuest(quest)}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function BadgePill({ difficulty }: { difficulty: QuestDifficulty }) {
  const badge = difficultyBadge(difficulty);
  return (
    <View style={[styles.badgePill, { backgroundColor: badge.color }]}>
      <Text style={styles.badgeLabel}>{badge.label}</Text>
    </View>
  );
}

function CategoryChips({ categories }: { categories: QuestCategory[] }) {
  return (
    <View style={styles.chipRow}>
      {categories.map((category) => (
        <View key={category} style={styles.chip}>
          <Text style={styles.chipLabel}>{CATEGORY_LABELS[category]}</Text>
        </View>
      ))}
    </View>
  );
}

function QuestCard({
  quest,
  completedToday,
  hero,
  onPress,
}: {
  quest: ActiveQuest;
  completedToday: boolean;
  hero?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.card, hero && styles.heroCard]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, hero && styles.heroTitle]}>{quest.title}</Text>
        <BadgePill difficulty={quest.difficulty} />
      </View>
      <Text style={styles.cardMeta}>
        {formatDuration(quest.durationSec)} · {quest.xpReward} XP
      </Text>
      <CategoryChips categories={quest.categories} />
      <Text style={styles.masteryLine}>
        Masteries: {quest.categories.map((c) => CATEGORY_LABELS[c]).join(' + ')}
      </Text>
      {completedToday ? (
        <View style={styles.donePill}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.doneLabel}>Done for today</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function QuestRow({
  quest,
  completedToday,
  onPress,
}: {
  quest: ActiveQuest;
  completedToday: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>{quest.title}</Text>
        <Text style={styles.rowMeta}>
          {formatDuration(quest.durationSec)} · {quest.xpReward} XP
        </Text>
      </View>
      {completedToday ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
      ) : (
        <BadgePill difficulty={quest.difficulty} />
      )}
    </TouchableOpacity>
  );
}

function ResumeBanner({
  title,
  onResume,
  onDismiss,
}: {
  title: string | null;
  onResume: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.resumeBanner}>
      <View style={styles.resumeHeader}>
        <Ionicons name="timer-outline" size={20} color={colors.calm} />
        <Text style={styles.resumeTitle}>
          {title ? `Unfinished quest: ${title}` : 'Unfinished quest'}
        </Text>
      </View>
      <Text style={styles.resumeLine}>Pick up where you left off.</Text>
      <View style={styles.resumeActions}>
        <TouchableOpacity accessibilityRole="button" style={styles.resumeButton} onPress={onResume}>
          <Text style={styles.resumeButtonLabel}>Resume</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.resumeLater}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onDismiss}
        >
          <Text style={styles.resumeLaterLabel}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
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
      <Animated.View style={[styles.skeletonTitleShort, { opacity }]} />
      <Animated.View style={[styles.skeletonCard, { opacity }]} />
      <Animated.View style={[styles.skeletonRow, { opacity }]} />
      <Animated.View style={[styles.skeletonRow, { opacity }]} />
      <Animated.View style={[styles.skeletonRow, { opacity }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
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
  header: {
    gap: spacing.xs,
  },
  greeting: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
  },
  greetingLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  streakPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  streakText: {
    color: colors.rewardStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  syncingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  syncingText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  resumeBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.calm,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  resumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resumeTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
    flexShrink: 1,
  },
  resumeLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  resumeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  resumeButton: {
    minHeight: 40,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButtonLabel: {
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 15,
  },
  resumeLater: {
    minHeight: 40,
    justifyContent: 'center',
  },
  resumeLaterLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 44,
  },
  heroCard: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
    flexShrink: 1,
  },
  heroTitle: {
    fontFamily: fonts.display.family,
    fontSize: 22,
  },
  cardMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  masteryLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  chipLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
  },
  badgePill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  badgeLabel: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
  },
  donePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  doneLabel: {
    color: colors.success,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  weeklyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  weeklyGoal: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.rewardStrong,
  },
  weeklyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weeklyCount: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  weeklyReward: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  quietLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 44,
  },
  rowLeft: {
    flexShrink: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  rowMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  skeletonWrap: {
    gap: spacing.md,
  },
  skeletonTitle: {
    height: 28,
    width: '60%',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonTitleShort: {
    height: 28,
    width: '35%',
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonCard: {
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonRow: {
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
});

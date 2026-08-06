import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { fetchQuestDetail, type QuestDetail, type QuestSegment } from '@/data/repositories/quests';
import { dayKey } from '@/domain/streak/dayKey';
import { difficultyBadge } from '@/features/questBoard/badges';
import { isCompletedToday } from '@/features/questBoard/completedToday';
import { formatDuration } from '@/features/questBoard/format';
import { formatSegmentDuration } from '@/features/questDetail/segmentDuration';
import { segmentKindLabel } from '@/features/questDetail/segmentKind';
import { segmentsTotal } from '@/features/questDetail/segmentsTotal';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useCharacterStore } from '@/state/characterStore';

const CATEGORY_LABELS: Record<string, string> = {
  strength: 'Strength',
  endurance: 'Endurance',
  mobility: 'Mobility',
  discipline: 'Focus',
};

export default function QuestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const questId = params.id;

  const { completions, refresh } = useCharacterStore();

  const [detail, setDetail] = useState<QuestDetail | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const load = useCallback(async () => {
    if (!questId) {
      setStatus('error');
      return;
    }
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const result = await fetchQuestDetail(questId);
    if (result.error) {
      setStatus('error');
      return;
    }
    setDetail(result.data);
    setStatus('ready');
  }, [questId]);

  // Re-fetch on focus so the completed-today chip and any S5 state stay fresh.
  useFocusEffect(
    useCallback(() => {
      void Promise.all([load(), refresh()]);
    }, [load, refresh]),
  );

  const completedToday = detail
    ? isCompletedToday(completions ?? [], detail.id, dayKey(new Date()))
    : false;

  const start = useCallback(() => {
    if (!detail) {
      return;
    }
    router.push({
      pathname: '/workout/[id]',
      params: { id: detail.id, title: detail.title },
    });
  }, [detail, router]);

  return (
    <Screen>
      <View style={styles.screen}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        {status === 'loading' || (status === 'idle' && !detail) ? (
          <SkeletonPulse />
        ) : status === 'error' || !detail ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>This quest is hiding.</Text>
            <Text style={styles.errorLine}>Could not load its details. Try again in a moment.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => {
                setStatus('loading');
                void load();
              }}
            >
              <Text style={styles.retryLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.header}>
                <Text style={styles.title}>{detail.title}</Text>
                <Badge difficulty={detail.difficulty} />
                <Text style={styles.meta}>
                  {formatDuration(detail.durationSec)} · +{detail.xpReward} XP
                </Text>
                <View style={styles.chipRow}>
                  {detail.categories.map((category) => (
                    <View key={category} style={styles.chip}>
                      <Text style={styles.chipLabel}>{CATEGORY_LABELS[category] ?? category}</Text>
                    </View>
                  ))}
                </View>
                {completedToday ? (
                  <View style={styles.donePill}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.doneLabel}>Done for today — you can still go again.</Text>
                  </View>
                ) : null}
                {detail.description ? (
                  <Text style={styles.description}>{detail.description}</Text>
                ) : null}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Quest</Text>
                {detail.segments.map((segment) => (
                  <SegmentRow key={segment.position} segment={segment} />
                ))}
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {formatDuration(segmentsTotal(detail.segments))}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.startButton}
                onPress={start}
              >
                <Text style={styles.startLabel}>Start</Text>
                <Ionicons name="play" size={20} color={colors.background} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function Badge({ difficulty }: { difficulty: QuestDetail['difficulty'] }) {
  const badge = difficultyBadge(difficulty);
  return (
    <View style={[styles.badge, { backgroundColor: badge.color }]}>
      <Text style={styles.badgeLabel}>{badge.label}</Text>
    </View>
  );
}

function SegmentRow({ segment }: { segment: QuestSegment }) {
  const isRest = segment.kind === 'rest';
  const isEdge = segment.kind === 'warmup' || segment.kind === 'cooldown';
  const labelColor = isRest ? colors.textMuted : isEdge ? colors.calm : colors.text;
  return (
    <View style={styles.segmentRow}>
      <View style={styles.segmentLeft}>
        <Text style={[styles.segmentKind, { color: labelColor }]}>
          {segmentKindLabel(segment.kind)}
        </Text>
        {isRest ? (
          <Text style={styles.segmentRest}>Take a breather</Text>
        ) : (
          <Text style={styles.segmentName}>{segment.exerciseName ?? 'Move'}</Text>
        )}
      </View>
      <Text style={styles.segmentDuration}>{formatSegmentDuration(segment.durationSec)}</Text>
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
      <Animated.View style={[styles.skeletonLine, { opacity }]} />
      <Animated.View style={[styles.skeletonCard, { opacity }]} />
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
    paddingBottom: spacing.xl,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipLabel: {
    color: colors.text,
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
    paddingVertical: spacing.sm,
  },
  doneLabel: {
    color: colors.success,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  description: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
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
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  segmentLeft: {
    gap: 2,
  },
  segmentKind: {
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  segmentName: {
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 15,
  },
  segmentRest: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
  },
  segmentDuration: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
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
  skeletonCard: {
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonRow: {
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
});

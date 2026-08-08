import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { CHAPTERS, chapterForQuests } from '@/domain/journey/chapter';
import { artForChapterId } from '@/features/journey/art';
import { goalLine, journeyNodes, milestoneLine, type ChapterNode } from '@/features/journey/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useCharacterStore } from '@/state/characterStore';

/**
 * S7-01 — Journey Map (FR-JOURNEY-1..8). Read-only: no CTA, no gating beyond
 * pull-to-refresh; encouragement copy only (FR-JOURNEY-8). The feed is the
 * character snapshot's server-authoritative journey_quests/current_chapter
 * (M0019) refreshed on focus, exactly like the quest board.
 */
export default function JourneyScreen() {
  const { profile, status, refresh } = useCharacterStore();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const quests = profile?.journeyQuestCount ?? 0;
  const progress = chapterForQuests(quests);
  const nodes = journeyNodes(quests);
  const milestone = profile ? milestoneLine(quests, progress.current) : null;

  return (
    <Screen>
      {status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Your path is taking a breather.</Text>
          <Text style={styles.errorLine}>Could not load your journey. Try again in a moment.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={() => void refresh()}
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
              refreshing={status === 'loading'}
              onRefresh={() => void refresh()}
              tintColor={colors.rewardStrong}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Your Journey</Text>
            <Text style={styles.milestone}>{milestone ?? 'Walking your path — loading…'}</Text>
          </View>

          <View style={styles.timeline}>
            {nodes.map((node, index) => (
              <JourneyNode key={node.id} node={node} index={index} />
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function JourneyNode({ node, index }: { node: ChapterNode; index: number }) {
  const art = artForChapterId(node.id);
  const isCurrent = node.state === 'current';
  const isDone = node.state === 'completed';
  const isLocked = node.state === 'locked';

  return (
    <View style={styles.nodeRow}>
      <View style={styles.rail}>
        <View
          style={[
            styles.blob,
            { backgroundColor: isLocked ? colors.surfaceElevated : art?.blobColor },
          ]}
        >
          <Ionicons
            name={art?.icon ?? 'map-outline'}
            size={22}
            color={isLocked ? colors.textMuted : art?.iconColor}
          />
        </View>
        {index < CHAPTERS.length - 1 ? <View style={styles.railLine} /> : null}
      </View>

      <View style={styles.nodeBody}>
        <View style={styles.nodeHeader}>
          <Text style={[styles.nodeName, isLocked && styles.nodeNameLocked]}>{node.name}</Text>
          {isDone ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          ) : isCurrent ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.reward} />
          ) : (
            <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
          )}
        </View>
        <Text style={styles.nodeGoal}>{goalLine(CHAPTERS[index]!)}</Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.round(node.fraction * 100)}%` },
              isCurrent ? styles.barFillCurrent : null,
            ]}
          />
        </View>
        {node.meta ? <Text style={styles.nodeMeta}>{node.meta}</Text> : null}
      </View>
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
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
  },
  milestone: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
  },
  timeline: {
    gap: spacing.lg,
  },
  nodeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    width: 56,
    alignItems: 'center',
  },
  blob: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  railLine: {
    position: 'absolute',
    top: 40,
    bottom: -spacing.xl,
    width: 2,
    backgroundColor: colors.surfaceElevated,
  },
  nodeBody: {
    flex: 1,
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  nodeName: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
    flexShrink: 1,
  },
  nodeNameLocked: {
    color: colors.textMuted,
  },
  nodeGoal: {
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
    backgroundColor: colors.calm,
  },
  barFillCurrent: {
    backgroundColor: colors.reward,
  },
  nodeMeta: {
    color: colors.calmStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
});

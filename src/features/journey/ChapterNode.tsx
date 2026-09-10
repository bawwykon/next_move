/**
 * JOURNEY-01 — single chapter node (emblem + ring + label).
 * Emblem occupies 70-80% of node diameter per spec.
 * Three visual states: completed, current, locked.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { chapterArt } from '@/features/assets/assetMap';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import type { ChapterData } from './journeyData';
import type { ChapterState } from './useJourneyState';

const NODE_SIZE = 90;
const EMBLEM_SIZE = 70; // ~78% of 90

/** Per-emblem render box (px at 512 canvas) so visible art fills ~75% of 90dp node. */
const EMBLEM_BOX: Record<number, number> = {
  1: 130,
  2: 120,
  3: 117,
  4: 125,
  5: 90,
  6: 88,
  7: 79,
};

interface ChapterNodeProps {
  chapter: ChapterData;
  state: ChapterState;
  fraction: number;
  onPress: (chapterId: number) => void;
  /** If true, this is the current chapter — pulsing glow emphasis. */
  isCurrent?: boolean;
}

export function ChapterNode({
  chapter,
  state,
  fraction,
  onPress,
  isCurrent = false,
}: ChapterNodeProps) {
  const [pulseAnim] = useState(() => new Animated.Value(0.6));
  const emblem = chapterArt(chapter.id);
  const isLocked = state === 'locked';
  const isCompleted = state === 'completed';

  useEffect(() => {
    if (!isCurrent) {
      pulseAnim.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isCurrent, pulseAnim]);

  const ringColor = isCompleted
    ? colors.reward
    : isCurrent
      ? colors.rewardStrong
      : colors.textMuted;

  const nodeScale = isCurrent ? 1.12 : 1;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(chapter.id)}
      style={styles.wrapper}
    >
      <View style={[styles.nodeOuter, { transform: [{ scale: nodeScale }] }]}>
        {/* Glow ring for current */}
        {isCurrent ? (
          <Animated.View
            style={[
              styles.glowRing,
              {
                borderColor: colors.reward,
                opacity: pulseAnim,
              },
            ]}
          />
        ) : null}

        {/* Main ring */}
        <View style={[styles.ring, { borderColor: ringColor }]}>
          {emblem !== null ? (
            <Image
              source={emblem}
              style={[
                styles.emblem,
                {
                  width: EMBLEM_BOX[chapter.id] ?? EMBLEM_SIZE,
                  height: EMBLEM_BOX[chapter.id] ?? EMBLEM_SIZE,
                },
                isLocked && styles.emblemLocked,
              ]}
              contentFit="contain"
            />
          ) : (
            <Ionicons
              name="map-outline"
              size={28}
              color={isLocked ? colors.textMuted : colors.reward}
            />
          )}

          {/* Checkmark badge for completed */}
          {isCompleted ? (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={14} color={colors.background} />
            </View>
          ) : null}
        </View>
      </View>

      {/* Label */}
      <Text
        style={[styles.label, isLocked && styles.labelLocked, isCurrent && styles.labelCurrent]}
        numberOfLines={1}
      >
        {chapter.name}
      </Text>

      {/* Progress hint for current */}
      {isCurrent && fraction < 1 ? (
        <Text style={styles.progressHint}>{Math.round(fraction * 100)}%</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 140,
    gap: spacing.xs,
  },
  nodeOuter: {
    width: NODE_SIZE + 16,
    height: NODE_SIZE + 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: NODE_SIZE + 16,
    height: NODE_SIZE + 16,
    borderRadius: (NODE_SIZE + 16) / 2,
    borderWidth: 4,
  },
  ring: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'visible',
  },
  emblem: {
    borderRadius: radius.lg,
  },
  emblemLocked: {
    opacity: 0.4,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textAlign: 'center',
  },
  labelLocked: {
    color: colors.textMuted,
  },
  labelCurrent: {
    color: colors.reward,
  },
  progressHint: {
    color: colors.rewardStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
  },
});

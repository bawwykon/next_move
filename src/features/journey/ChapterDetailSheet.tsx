/**
 * JOURNEY-01 — chapter detail bottom sheet (Modal-based).
 * Shows emblem, name, flavor, requirement, progress, remaining, status.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { chapterArt } from '@/features/assets/assetMap';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import type { ChapterData } from './journeyData';
import type { ChapterState } from './useJourneyState';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface ChapterDetailSheetProps {
  visible: boolean;
  chapter: ChapterData | null;
  state: ChapterState;
  fraction: number;
  questsInChapter: number;
  span: number | null;
  onClose: () => void;
}

export function ChapterDetailSheet({
  visible,
  chapter,
  state,
  fraction,
  questsInChapter,
  span,
  onClose,
}: ChapterDetailSheetProps) {
  const [slideAnim] = useState(() => new Animated.Value(SCREEN_HEIGHT));

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 30,
        stiffness: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible, slideAnim]);

  if (!chapter) return null;

  const emblem = chapterArt(chapter.id);
  const isLocked = state === 'locked';
  const isCompleted = state === 'completed';
  const remaining = span !== null ? span - questsInChapter : null;

  const statusLabel = isCompleted
    ? 'Complete'
    : isLocked
      ? 'Locked'
      : fraction >= 1
        ? 'Complete'
        : 'In Progress';

  const statusColor =
    isCompleted || fraction >= 1 ? colors.success : isLocked ? colors.textMuted : colors.reward;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Animated.View style={[styles.sheetContent, { transform: [{ translateY: slideAnim }] }]}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Emblem */}
            <View style={[styles.emblemContainer, isLocked && styles.emblemLocked]}>
              {emblem !== null ? (
                <Image source={emblem} style={styles.emblem} contentFit="contain" />
              ) : (
                <Ionicons name="map-outline" size={48} color={colors.reward} />
              )}
            </View>

            {/* Name */}
            <Text style={styles.name}>{chapter.name}</Text>

            {/* Flavor */}
            {!isLocked ? <Text style={styles.flavor}>{chapter.flavor}</Text> : null}

            {/* Requirement */}
            {isLocked ? (
              <Text style={styles.requirement}>Reach {chapter.threshold} quests to unlock</Text>
            ) : null}

            {/* Progress (unlocked only) */}
            {!isLocked ? (
              <View style={styles.progressSection}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.round((span !== null ? fraction : 1) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {span !== null
                    ? `${questsInChapter} / ${span} quests`
                    : `${chapter.threshold} / ${chapter.threshold} quests`}
                </Text>
                {remaining !== null && remaining > 0 ? (
                  <Text style={styles.remaining}>{remaining} quests remaining</Text>
                ) : null}
              </View>
            ) : null}

            {/* Status */}
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '70%',
  },
  sheetContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
  },
  emblemContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent', // remove dark gray circle
    overflow: 'hidden',
  },
  emblemLocked: {
    opacity: 0.4,
  },
  emblem: {
    width: 240,
    height: 240,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 22,
    textAlign: 'center',
  },
  flavor: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  requirement: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    textAlign: 'center',
  },
  progressSection: {
    width: '100%',
    gap: spacing.xs,
  },
  barTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
  },
  progressText: {
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 14,
    textAlign: 'center',
  },
  remaining: {
    color: colors.calmStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textAlign: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  statusText: {
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
});

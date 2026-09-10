/**
 * JOURNEY-01 — compact current chapter panel below the map.
 * Shows emblem, name, flavor, progress bar, remaining quests.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { chapterArt } from '@/features/assets/assetMap';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import type { JourneyChapter } from './useJourneyState';

interface CurrentChapterPanelProps {
  chapter: JourneyChapter;
}

export function CurrentChapterPanel({ chapter }: CurrentChapterPanelProps) {
  const emblem = chapterArt(chapter.data.id);
  const remaining = chapter.span !== null ? chapter.span - chapter.questsInChapter : null;
  const isComplete = chapter.fraction >= 1;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Emblem */}
        <View style={styles.emblemContainer}>
          {emblem !== null ? (
            <Image source={emblem} style={styles.emblem} contentFit="contain" />
          ) : (
            <Ionicons name="map-outline" size={24} color={colors.reward} />
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name}>{chapter.data.name}</Text>
          <Text style={styles.flavor} numberOfLines={2}>
            {chapter.data.flavor}
          </Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(chapter.fraction * 100)}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {chapter.questsInChapter}
          {chapter.span !== null ? ` / ${chapter.span}` : ''}
          {' quests'}
        </Text>
      </View>

      <Text style={styles.remaining}>
        {isComplete
          ? 'Chapter Complete'
          : remaining !== null
            ? `${remaining} quests remaining`
            : 'The summit is yours'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  emblemContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emblem: {
    width: 56,
    height: 56,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
  },
  flavor: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    fontStyle: 'italic',
  },
  progressRow: {
    gap: spacing.xs,
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
  progressText: {
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  remaining: {
    color: colors.calmStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
});

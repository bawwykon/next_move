import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { JourneyResult } from '@/domain/completion/types';
import { colors, fonts, radius, spacing } from '@/lib/theme';

interface JourneyCardProps {
  journey: JourneyResult;
  streak: number;
}

/**
 * S6-01 — journey block: the chapter read (chapter_before → after) plus the
 * threshold progress toward the next one, and the streak headline.
 */
export function JourneyCard({ journey, streak }: JourneyCardProps) {
  const { t } = useTranslation();
  const movedChapter = journey.chapter_after > journey.chapter_before;
  const progress =
    journey.next_threshold !== null ? Math.min(1, journey.quests / journey.next_threshold) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('victory.yourJourney')}</Text>

      <View style={styles.chapterRow}>
        <Ionicons name="map-outline" size={20} color={colors.calmStrong} />
        <Text style={styles.chapterText}>
          {movedChapter
            ? t('victory.chapterMoved', { n: journey.chapter_after })
            : t('victory.chapterSame', { n: journey.chapter_after })}
        </Text>
      </View>

      {progress !== null ? (
        <View style={styles.threshold}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { backgroundColor: movedChapter ? colors.reward : colors.calm },
                { transform: [{ scaleX: progress }] },
              ]}
            />
          </View>
          <Text style={styles.thresholdMeta}>
            {t('victory.journeyProgress', {
              done: journey.quests,
              total: journey.next_threshold,
            })}
          </Text>
        </View>
      ) : (
        <Text style={styles.thresholdMeta}>{t('victory.journeyNoNext')}</Text>
      )}

      {streak > 0 ? (
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={18} color={colors.danger} />
          <Text style={styles.streakText}>{t('victory.streakDays', { count: streak })}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chapterText: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
    flex: 1,
  },
  threshold: {
    gap: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    transformOrigin: 'left',
  },
  thresholdMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakText: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
});

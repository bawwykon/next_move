import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { difficultyBadge } from '@/features/questBoard/badges';
import { formatDuration } from '@/features/questBoard/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';

/**
 * SFR stub for S3-03 — name, duration, difficulty only. The full quest detail
 * (segments preview + Start) lands in S3-03.
 */
export default function QuestDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    durationSec?: string;
    difficulty?: string;
  }>();

  const title = params.title ?? 'Quest';
  const durationSec = Number(params.durationSec ?? 0);
  const difficulty =
    params.difficulty === 'easy' ||
    params.difficulty === 'normal' ||
    params.difficulty === 'hard' ||
    params.difficulty === 'elite'
      ? params.difficulty
      : 'easy';
  const badge = difficultyBadge(difficulty);

  return (
    <Screen>
      <View style={styles.content}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeLabel}>{badge.label}</Text>
          </View>
          <Text style={styles.meta}>
            {formatDuration(durationSec)} · {difficulty}
          </Text>
          <Text style={styles.quiet}>Quest details are coming in S3-03.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.lg,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  backLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
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
  quiet: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { UnlockOverview } from '@/features/victory/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';

interface UnlocksCardProps {
  overview: UnlockOverview;
}

/**
 * S6-01 — unlock grouping: achievements and cosmetics each get their own
 * section so freshly earned entitlements read clearly apart from the XP.
 * Renders nothing when this completion unlocked nothing.
 */
export function UnlocksCard({ overview }: UnlocksCardProps) {
  if (!overview.hasUnlocks) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Unlocked</Text>

      {overview.achievements.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Achievements</Text>
          {overview.achievements.map((unlock) => (
            <View key={unlock.id} style={styles.row}>
              <Ionicons name="trophy-outline" size={20} color={colors.reward} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowName}>{unlock.title}</Text>
                <Text style={styles.rowMeta}>{unlock.category}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {overview.cosmetics.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Fresh look</Text>
          {overview.cosmetics.map((unlock) => (
            <View key={unlock.id} style={styles.row}>
              <Ionicons name="sparkles-outline" size={20} color={colors.calm} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowName}>{unlock.name}</Text>
                <Text style={styles.rowMeta}>{unlock.type}</Text>
              </View>
            </View>
          ))}
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
    gap: spacing.lg,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: 1,
  },
  rowName: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  rowMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
});

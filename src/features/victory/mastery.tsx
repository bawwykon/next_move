import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MasteryResult } from '@/domain/completion/types';
import { masteryDeltas } from '@/features/victory/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';

interface MasteryCardProps {
  rows: MasteryResult[];
}

/**
 * S6-01 — FR-MAS-6 per-track delta card. Each changed track shows its points
 * movement and the current title from the title ladder (FR-MAS-3); tracks
 * whose level increased are accented, but points-only gains still count as
 * progress, so they stay visible.
 */
export function MasteryCard({ rows }: MasteryCardProps) {
  const deltas = useMemo(() => masteryDeltas(rows), [rows]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Skill levels</Text>
      {deltas.map((delta) => (
        <View key={delta.track} style={styles.row}>
          <View style={styles.rowLabelGroup}>
            <Text style={styles.rowLabel}>{delta.trackLabel}</Text>
            <Text style={styles.rowPoints}>
              {delta.pointsBefore} → {delta.pointsAfter}
            </Text>
          </View>
          <View
            style={[
              styles.chip,
              { backgroundColor: delta.leveledUp ? colors.reward : colors.calm },
            ]}
          >
            <Text style={styles.chipText}>{delta.levelTitle}</Text>
          </View>
        </View>
      ))}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabelGroup: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  rowPoints: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

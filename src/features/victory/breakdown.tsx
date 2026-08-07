import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { XpBreakdown } from '@/domain/completion/types';
import { xpBreakdownRows, xpBreakdownTotal } from '@/features/victory/format';
import { formatXp } from '@/lib/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';

interface BreakdownCardProps {
  xp: XpBreakdown;
}

/**
 * S6-01 — FR-XP-6 rewards card. The rows are a pure view over the
 * authoritative payload; each row slides in with a small stagger once the
 * payload has landed, and the total is always a separate row from the source
 * stages so the grants stay legible.
 */
export function BreakdownCard({ xp }: BreakdownCardProps) {
  const rows = useMemo(() => xpBreakdownRows(xp), [xp]);
  const total = useMemo(() => xpBreakdownTotal(xp), [xp]);
  // Mounted only after the payload landed, so rows are stable from first paint.
  const [reveals] = useState(() => rows.map(() => new Animated.Value(0)));

  useEffect(() => {
    const animation = Animated.stagger(
      90,
      reveals.map((value) =>
        Animated.parallel([
          Animated.timing(value, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [reveals]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Rewards</Text>
      {rows.map((row, index) => (
        <Animated.View
          key={row.label}
          style={[
            styles.row,
            {
              opacity: reveals[index],
              transform: [
                {
                  translateY: reveals[index]!.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.rowLabel}>{row.label}</Text>
          <Text style={styles.rowValue}>+{row.xp} XP</Text>
        </Animated.View>
      ))}
      <View style={styles.divider} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatXp(total)}</Text>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
  },
  rowValue: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceElevated,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
  },
  totalValue: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 20,
  },
});

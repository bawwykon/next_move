import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import {
  fetchAchievementCatalog,
  fetchProfileAchievements,
} from '@/data/repositories/achievements';
import { supabase } from '@/data/supabase';
import {
  mergeCatalogWithUnlocks,
  type AchievementCatalogRow,
  type AchievementRow,
  type AchievementUnlock,
} from '@/domain/achievements/merge';
import {
  ACHIEVEMENT_CATEGORY_ART,
  lockedRowStrings,
  unlockedRowStrings,
} from '@/features/achievements/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';

/**
 * S7-02 — Achievements (FR-ACH-1/4/5). Read-only list of the 13-achievement
 * seat small catalogue: unlocked = full-color code-drawn emblem + title +
 * description + unlock date; locked = dimmed "?" emblem + vague hint. No
 * progress bars, no rule-derived numbers, encouragement copy only.
 */
export default function AchievementsScreen() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<AchievementCatalogRow[] | null>(null);
  const [unlocks, setUnlocks] = useState<AchievementUnlock[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const load = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus('error');
      return;
    }
    const [catalogResult, unlocksResult] = await Promise.all([
      fetchAchievementCatalog(),
      fetchProfileAchievements(user.id),
    ]);
    if (catalogResult.error || unlocksResult.error) {
      setStatus('error');
      return;
    }
    setCatalog(catalogResult.data ?? []);
    setUnlocks(unlocksResult.data ?? []);
    setStatus('ready');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows = useMemo(
    () => (catalog ? mergeCatalogWithUnlocks(catalog, unlocks) : []),
    [catalog, unlocks],
  );
  const unlockedCount = rows.filter((row) => row.state === 'unlocked').length;

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

        {status === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>The milestone board took a pause.</Text>
            <Text style={styles.errorLine}>
              Could not load your achievements. Try again in a moment.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => void load()}
            >
              <Text style={styles.retryLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Achievements</Text>
              <Text style={styles.subtitle}>
                {status === 'ready'
                  ? `You've unlocked ${unlockedCount} of ${rows.length} — each one earned.`
                  : 'Loading your milestones…'}
              </Text>
            </View>

            <View style={styles.list}>
              {rows.map((row) => (
                <AchievementRowView key={row.slug} row={row} />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

function AchievementRowView({ row }: { row: AchievementRow }) {
  const art = ACHIEVEMENT_CATEGORY_ART[row.category];
  const isLocked = row.state === 'locked';

  if (isLocked) {
    const strings = lockedRowStrings(row);
    return (
      <View style={[styles.row, styles.rowLocked]}>
        <View style={[styles.emblem, styles.emblemLocked]}>
          <Text style={styles.questionMark}>{strings[0]}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, styles.rowTitleLocked]}>{strings[1]}</Text>
          <Text style={styles.rowHint}>{strings[2]}</Text>
        </View>
      </View>
    );
  }

  const strings = unlockedRowStrings(row);
  return (
    <View style={styles.row}>
      <View style={[styles.emblem, { backgroundColor: art.blobColor }]}>
        <Ionicons name={art.icon} size={26} color={art.iconColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{strings[0]}</Text>
        <Text style={styles.rowDescription}>{strings[1]}</Text>
        <Text style={styles.rowDate}>{strings[2]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.md,
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
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  rowLocked: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
  },
  emblem: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemLocked: {
    backgroundColor: colors.surfaceElevated,
  },
  questionMark: {
    color: colors.textMuted,
    fontFamily: fonts.display.family,
    fontSize: 26,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  rowTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
  },
  rowTitleLocked: {
    color: colors.textMuted,
  },
  rowDescription: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
  rowHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    fontStyle: 'italic',
  },
  rowDate: {
    color: colors.calmStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
  },
});

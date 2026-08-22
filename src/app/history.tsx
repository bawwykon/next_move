import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import {
  fetchCompletionHistory,
  HISTORY_PAGE_SIZE,
  type CompletionHistoryRow,
} from '@/data/repositories/history';
import { supabase } from '@/data/supabase';
import { dayKey } from '@/domain/streak/dayKey';
import { withTapCue } from '@/lib/sounds';
import { historyExhausted, historyLines } from '@/features/profile/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';

/**
 * AT-02G — dedicated paged quest history (FR-PROF-1). The profile card keeps
 * a four-row preview; this screen walks the full 30-day window page by page
 * through the same repo paging the profile used to own.
 */
export default function HistoryScreen() {
  const router = useRouter();

  const [rows, setRows] = useState<CompletionHistoryRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus('error');
      return;
    }
    const result = await fetchCompletionHistory(user.id, {
      limit: HISTORY_PAGE_SIZE,
      offset: 0,
    });
    if (result.error) {
      setStatus('error');
      return;
    }
    setRows(result.data ?? []);
    setStatus('ready');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
    }, [loadFirstPage]),
  );

  const loadMore = useCallback(async () => {
    if (!loadingMore) {
      setLoadingMore(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const result = await fetchCompletionHistory(user.id, {
          limit: HISTORY_PAGE_SIZE,
          offset: rows.length,
        });
        if (!result.error && (result.data?.length ?? 0) > 0) {
          setRows((current) => [...current, ...(result.data ?? [])]);
        }
      }
      setLoadingMore(false);
    }
  }, [loadingMore, rows.length]);

  const todayKey = dayKey(new Date());
  const items = useMemo(() => historyLines(rows, todayKey), [rows, todayKey]);
  const exhausted = historyExhausted(rows.length, HISTORY_PAGE_SIZE);

  return (
    <Screen>
      <View style={styles.screen}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={withTapCue(() => router.back())}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        {status === 'loading' ? (
          <Text style={styles.note}>Loading your quest history…</Text>
        ) : status === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.empty}>Could not load your history. Try again in a moment.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={withTapCue(() => void loadFirstPage())}
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
            <Text style={styles.title}>Quest history</Text>
            <Text style={styles.note}>Every quest from the last 30 days.</Text>
            {items.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.empty}>
                  History begins with your first quest — every one counts.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.list}>
                  {items.map((item, index) => (
                    <View key={`${item.questTitle}-${index}`} style={styles.row}>
                      <View style={styles.body}>
                        <Text style={styles.rowTitle}>{item.questTitle ?? 'Quest completed'}</Text>
                        <Text style={styles.rowDay}>{item.dayLabel}</Text>
                      </View>
                      <Text style={styles.rowXp}>+{item.xp} XP</Text>
                    </View>
                  ))}
                </View>
                {!exhausted ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.loadMore}
                    onPress={withTapCue(() => void loadMore())}
                  >
                    <Text style={styles.loadMoreLabel}>
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.end}>{`That's all from the last 30 days.`}</Text>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    marginBottom: spacing.md,
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
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 28,
  },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  rowDay: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  rowXp: {
    color: colors.calmStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  loadMore: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
  },
  loadMoreLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  end: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    textAlign: 'center',
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    fontStyle: 'italic',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
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
});

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { fetchJournalEntries } from '@/data/repositories/journal';
import { supabase } from '@/data/supabase';
import { dayKey } from '@/domain/streak/dayKey';
import { withTapCue } from '@/lib/sounds';
import { journalSections } from '@/features/journal/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';

/**
 * PH4-01 — quest journal: every completion auto-written as a dated entry
 * (no new table; a read-only projection of quest_completions). Grouped by
 * day, newest first, with a calm empty state before the first quest.
 */
export default function JournalScreen() {
  const router = useRouter();

  const [rows, setRows] = useState<Parameters<typeof journalSections>[0]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus('error');
      return;
    }
    const result = await fetchJournalEntries(user.id);
    if (result.error) {
      setStatus('error');
      return;
    }
    setRows(result.data ?? []);
    setStatus('ready');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const todayKey = dayKey(new Date());
  const sections = useMemo(() => journalSections(rows, todayKey), [rows, todayKey]);

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
          <Text style={styles.note}>Opening your journal…</Text>
        ) : status === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.empty}>Could not open your journal. Try again in a moment.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={withTapCue(() => void load())}
            >
              <Text style={styles.retryLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Journal</Text>
            <Text style={styles.note}>Your quests, written down automatically.</Text>
            {sections.length === 0 ? (
              <View style={styles.card}>
                <Ionicons name="book-outline" size={28} color={colors.textMuted} />
                <Text style={styles.empty}>
                  Your journal begins with your first quest. Complete one and it will be written
                  here.
                </Text>
              </View>
            ) : (
              sections.map((section) => (
                <View key={section.key} style={styles.section}>
                  <Text style={styles.dayLabel}>{section.dayLabel}</Text>
                  <View style={styles.card}>
                    {section.entries.map((entry) => (
                      <View key={entry.key} style={styles.entryRow}>
                        <Text style={styles.entryTitle}>{entry.title}</Text>
                        <Text style={styles.entryMeta}>{entry.metaLine}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
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
    paddingVertical: spacing.md,
  },
  backLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
  },
  content: {
    paddingBottom: spacing.xxxl,
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
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  dayLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  entryRow: {
    alignSelf: 'stretch',
    gap: 2,
  },
  entryTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  entryMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
});

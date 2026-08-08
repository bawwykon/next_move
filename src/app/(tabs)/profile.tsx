import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { fetchProfileAchievements } from '@/data/repositories/achievements';
import {
  fetchProfile,
  fetchMastery,
  equipCosmetic,
  type CharacterProfile,
  type MasteryRow,
} from '@/data/repositories/board';
import { fetchCosmeticCatalog, type CosmeticRow } from '@/data/repositories/cosmetics';
import {
  fetchCompletionHistory,
  HISTORY_PAGE_SIZE,
  type CompletionHistoryRow,
} from '@/data/repositories/history';
import { fetchProfileCosmetics } from '@/data/repositories/profileCosmetics';
import { supabase } from '@/data/supabase';
import { dayKey } from '@/domain/streak/dayKey';
import { ownedBySlug, validateEquip, type CosmeticSlot } from '@/domain/cosmetics/loadout';
import { LoadoutCard } from '@/features/profile/LoadoutCard';
import {
  historyExhausted,
  historyLines,
  levelLine,
  masteryRows,
  streakCopy,
  xpBar,
  achievementsEntry,
  formatXp,
} from '@/features/profile/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

/**
 * S8-01 — the character page (FR-PROF-1/2). Read-only: every figure is either
 * a server-authoritative column (level, total XP, streaks, equipped_*) or a
 * pure display derivation over it (XP bar fraction, mastery bars, loadout
 * names). The Achievements entry (S7-02) now shows the live unlock count.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const email = useSessionStore((state) => state.session?.user?.email ?? '');
  const signOut = useSessionStore((state) => state.signOut);

  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [mastery, setMastery] = useState<MasteryRow[]>([]);
  const [catalog, setCatalog] = useState<CosmeticRow[]>([]);
  const [owned, setOwned] = useState<ReadonlySet<string>>(new Set());
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [history, setHistory] = useState<CompletionHistoryRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const loadFirstPage = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus('error');
      return;
    }
    const [profileResult, masteryResult, catalogResult, ownedResult, unlocksResult, historyResult] =
      await Promise.all([
        fetchProfile(user.id),
        fetchMastery(user.id),
        fetchCosmeticCatalog(),
        fetchProfileCosmetics(user.id),
        fetchProfileAchievements(user.id),
        fetchCompletionHistory(user.id, { limit: HISTORY_PAGE_SIZE, offset: 0 }),
      ]);
    const firstError = [
      profileResult,
      masteryResult,
      catalogResult,
      ownedResult,
      unlocksResult,
      historyResult,
    ].find((result) => result.error);
    if (firstError) {
      setStatus('error');
      return;
    }
    setProfile(profileResult.data ?? null);
    setMastery(masteryResult.data ?? []);
    setCatalog(catalogResult.data ?? []);
    setOwned(ownedBySlug(ownedResult.data ?? []));
    setUnlockedCount(unlocksResult.data?.length ?? 0);
    setHistory(historyResult.data ?? []);
    setStatus('ready');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
    }, [loadFirstPage]),
  );

  const loadMore = useCallback(async () => {
    if (!profile) {
      return;
    }
    const result = await fetchCompletionHistory(profile.id, {
      limit: HISTORY_PAGE_SIZE,
      offset: history.length,
    });
    if (!result.error) {
      setHistory((current) => [...current, ...(result.data ?? [])]);
    }
  }, [profile, history.length]);

  /**
   * S8-02 — optimistic equip with revert-on-error. The domain verdict gates
   * the write first (unowned items can never reach the database through this
   * path, even if the picker skipped a tap); the DB statement only touches
   * the equipped_* column (guard: client-writable).
   */
  const handleEquip = useCallback(
    async (slot: CosmeticSlot, itemId: string | null): Promise<string | null> => {
      if (!profile) {
        return 'Not ready yet — try again in a moment.';
      }
      const verdict = validateEquip(slot, itemId, owned, catalog);
      if (!verdict.ok) {
        return 'This one is still locked for you.';
      }
      const previous = profile.equipped[slot];
      setProfile((current) =>
        current ? { ...current, equipped: { ...current.equipped, [slot]: itemId } } : current,
      );
      const result = await equipCosmetic(profile.id, slot, itemId);
      if (result.error) {
        setProfile((current) =>
          current ? { ...current, equipped: { ...current.equipped, [slot]: previous } } : current,
        );
        return 'Could not save. Give it one more try.';
      }
      return null;
    },
    [profile, owned, catalog],
  );

  const initials = email ? (email.split('@')[0] ?? '').slice(0, 2).toUpperCase() : 'A';
  const todayKey = dayKey(new Date());
  const bar = useMemo(
    () => (profile ? xpBar(profile.totalXp, profile.level) : xpBar(0, 1)),
    [profile],
  );
  const streaks = useMemo(
    () => (profile ? streakCopy(profile.currentStreak, profile.longestStreak) : streakCopy(0, 0)),
    [profile],
  );
  const masteryRowsView = useMemo(() => masteryRows(mastery), [mastery]);
  const historyView = useMemo(() => historyLines(history, todayKey), [history, todayKey]);
  const exhausted = historyExhausted(history.length, HISTORY_PAGE_SIZE);

  return (
    <Screen>
      <View style={styles.screen}>
        {status === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>The profile took a pause.</Text>
            <Text style={styles.errorLine}>
              Could not load your character page. Try again in a moment.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={() => void loadFirstPage()}
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
              <View style={styles.avatar} accessibilityLabel={`Profile for ${email}`}>
                <Text style={styles.initials}>{initials}</Text>
              </View>
              <Text style={styles.name}>
                {profile?.displayName ?? (email ? `Signed in as ${email}` : 'Your journey')}
              </Text>
              <Text style={styles.levelLine}>
                {profile ? levelLine(profile.level) : 'Level 1 · Beginner'}
              </Text>
            </View>

            {/* XP bar + total (FR-XP-2 curve; pure derivation, server columns). */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Experience</Text>
                <Text style={styles.cardMeta}>{formatXp(bar.totalXp)} XP total</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, { width: `${bar.fraction * 100}%` }]}
                  accessibilityLabel={`${Math.round(bar.fraction * 100)}% of level ${profile?.level ?? 1}`}
                />
              </View>
              <Text style={styles.barCaption}>
                {formatXp(bar.intoXp)} / {formatXp(bar.neededXp)} XP into this level
              </Text>
            </View>

            {/* Streak (server columns, FR-STR-2 copy). */}
            <View style={styles.card}>
              <View style={styles.streakRow}>
                <Ionicons name="flame" size={22} color={colors.rewardStrong} />
                <Text style={styles.streakPrimary}>{streaks.primary}</Text>
              </View>
              {streaks.longest ? <Text style={styles.streakLongest}>{streaks.longest}</Text> : null}
            </View>

            {/* Mastery bars (FR-MAS-4). */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mastery</Text>
              <View style={styles.masteryList}>
                {masteryRowsView.map((row) => (
                  <View key={row.track} style={styles.masteryRow}>
                    <View style={styles.masteryLabels}>
                      <Text style={styles.masteryLabel}>{row.label}</Text>
                      <Text style={styles.masteryLevel}>
                        Lv {row.level} · {row.levelTitle}
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFillCalm, { width: `${row.fraction * 100}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Badges — the Achievements entry with a live count. */}
            <View style={styles.card}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.entryRow}
                onPress={() => router.push('/achievements')}
              >
                <Ionicons name="trophy-outline" size={22} color={colors.reward} />
                <Text style={styles.entryLabel}>Achievements</Text>
                <Text style={styles.entryCount}>{achievementsEntry(unlockedCount)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Cosmetic loadout — FR-COS-1/2: tap a slot to open the picker. */}
            <LoadoutCard
              catalog={catalog}
              owned={owned}
              equipped={profile?.equipped ?? emptyEquipped}
              onEquip={handleEquip}
            />

            {/* Quest history — 30-day window, paged (FR-PROF-1). */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quest history</Text>
              {historyView.length === 0 ? (
                <Text style={styles.historyEmpty}>
                  History begins with your first quest — every one counts.
                </Text>
              ) : (
                <View style={styles.historyList}>
                  {historyView.map((item, index) => (
                    <View key={`${item.questTitle}-${index}`} style={styles.historyRow}>
                      <View style={styles.historyBody}>
                        <Text style={styles.historyTitle}>
                          {item.questTitle ?? 'Quest completed'}
                        </Text>
                        <Text style={styles.historyDay}>{item.dayLabel}</Text>
                      </View>
                      <Text style={styles.historyXp}>+{item.xp} XP</Text>
                    </View>
                  ))}
                </View>
              )}
              {historyView.length > 0 && !exhausted ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.loadMore}
                  onPress={() => void loadMore()}
                >
                  <Text style={styles.loadMoreLabel}>Load more</Text>
                </TouchableOpacity>
              ) : null}
              {historyView.length > 0 && exhausted ? (
                <Text style={styles.historyEnd}>{`That's all from the last 30 days.`}</Text>
              ) : null}
            </View>

            <View style={styles.footer}>
              <AppButton label="Sign out" variant="secondary" onPress={() => void signOut()} />
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

const emptyEquipped = { frame: null, title: null, background: null, portrait: null };

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
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
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 36,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 20,
    textAlign: 'center',
  },
  levelLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  cardMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
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
  barFillCalm: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.calm,
  },
  barCaption: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakPrimary: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
    flex: 1,
  },
  streakLongest: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  masteryList: {
    gap: spacing.md,
  },
  masteryRow: {
    gap: spacing.xs,
  },
  masteryLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masteryLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  masteryLevel: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  entryLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  entryCount: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  historyList: {
    gap: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  historyBody: {
    flex: 1,
    gap: spacing.xs,
  },
  historyTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  historyDay: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  historyXp: {
    color: colors.calmStrong,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  historyEmpty: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    fontStyle: 'italic',
  },
  historyEnd: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    textAlign: 'center',
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
  footer: {
    paddingTop: spacing.sm,
  },
});

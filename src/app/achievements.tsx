import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import {
  fetchAchievementCatalog,
  fetchProfileAchievements,
} from '@/data/repositories/achievements';
import { fetchProfile } from '@/data/repositories/board';
import { supabase } from '@/data/supabase';
import { withTapCue } from '@/lib/sounds';
import {
  type AchievementCatalogRow,
  type AchievementRow,
  type AchievementUnlock,
  mergeCatalogWithUnlocks,
} from '@/domain/achievements/merge';
import { achievementArt } from '@/features/assets/assetMap';
import {
  ACHIEVEMENT_CATEGORY_ART,
  lockedRowStrings,
  unlockedRowStrings,
} from '@/features/achievements/format';
import { RARITY_BORDER, rarityFor } from '@/domain/badges/rarity';
import { badgeProgress } from '@/domain/badges/progress';
import { colors, fonts, radius, spacing } from '@/lib/theme';

// Uniform badge sizing (FIX-04) no longer needs per-slug boxes — keep for reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BADGE_BOX: Record<string, number> = {
  'early-bird': 113,
  'first-level': 125,
  'first-quest': 122,
  'first-week': 133,
  'master-adventurer': 101,
  'night-owl': 120,
  phoenix: 104,
  'streak-100': 106,
  'streak-30': 95,
  'streak-7': 116,
  'workouts-100': 122,
  'workouts-250': 108,
  'workouts-50': 136,
  'founders-emblem': 120,
};

type Tab = 'badges' | 'list';

export default function AchievementsScreen() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<AchievementCatalogRow[] | null>(null);
  const [unlocks, setUnlocks] = useState<AchievementUnlock[]>([]);
  const [equippedBadge, setEquippedBadge] = useState<string | null>(null);
  const [profileStats, setProfileStats] = useState<{
    questCount: number;
    streak: number;
    level: number;
  } | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [tab, setTab] = useState<Tab>('badges');

  const load = useCallback(async () => {
    setStatus((c) => (c === 'ready' ? c : 'loading'));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setStatus('error');
      return;
    }
    const [catalogResult, unlocksResult, profileResult] = await Promise.all([
      fetchAchievementCatalog(),
      fetchProfileAchievements(user.id),
      fetchProfile(user.id),
    ]);
    if (catalogResult.error || unlocksResult.error) {
      setStatus('error');
      return;
    }
    setCatalog(catalogResult.data ?? []);
    setUnlocks(unlocksResult.data ?? []);
    if (profileResult.data) {
      setProfileStats({
        questCount: profileResult.data.journeyQuestCount,
        streak: profileResult.data.currentStreak,
        level: profileResult.data.level,
      });
      setEquippedBadge(profileResult.data.equipped.badge ?? null);
    }
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
  const unlockedCount = rows.filter((r) => r.state === 'unlocked').length;

  const handleEquip = useCallback(
    async (slug: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const isEquipped = equippedBadge === slug;
      const next = isEquipped ? null : slug;
      setEquippedBadge(next);
      const { error } = await supabase
        .from('profiles')
        .update({ equipped_badge: next } as never)
        .eq('id', user.id);
      if (error) setEquippedBadge(equippedBadge);
    },
    [equippedBadge],
  );

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

        {status === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>The milestone board took a pause.</Text>
            <Text style={styles.errorLine}>
              Could not load your achievements. Try again in a moment.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={withTapCue(() => void load())}
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

            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === 'badges' && styles.tabActive]}
                onPress={withTapCue(() => setTab('badges'))}
              >
                <Text style={[styles.tabLabel, tab === 'badges' && styles.tabLabelActive]}>
                  Badge Collection
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'list' && styles.tabActive]}
                onPress={withTapCue(() => setTab('list'))}
              >
                <Text style={[styles.tabLabel, tab === 'list' && styles.tabLabelActive]}>
                  Details
                </Text>
              </TouchableOpacity>
            </View>

            {tab === 'badges' ? (
              <View style={styles.grid}>
                {rows.map((row) => {
                  const isUnlocked = row.state === 'unlocked';
                  const rarity = rarityFor(row.slug, row.rarity ?? 'Common');
                  const borderColor = RARITY_BORDER[rarity];
                  const progress = !isUnlocked
                    ? badgeProgress(row.slug, {
                        questCount: profileStats?.questCount ?? 0,
                        streak: profileStats?.streak ?? 0,
                        level: profileStats?.level ?? 1,
                        distinctDays: 0,
                        earlyBirdCount: 0,
                        nightOwlCount: 0,
                        gapDays: null,
                      })
                    : null;
                  const isEquipped = equippedBadge === row.slug;
                  const art = achievementArt(row.slug);
                  return (
                    <TouchableOpacity
                      key={row.slug}
                      accessibilityRole="button"
                      style={[
                        styles.gridCell,
                        { borderColor },
                        isEquipped && styles.gridCellEquipped,
                      ]}
                      onPress={withTapCue(() => {
                        if (isUnlocked) void handleEquip(row.slug);
                      })}
                      disabled={!isUnlocked}
                    >
                      <View style={styles.gridEmblem}>
                        {art ? (
                          <Image
                            source={art}
                            style={[
                              styles.gridBadge,
                              { width: 56, height: 56, aspectRatio: 1, maxWidth: 56 },
                              !isUnlocked && styles.badgeLocked,
                            ]}
                            contentFit="contain"
                          />
                        ) : (
                          <Text style={styles.questionMark}>?</Text>
                        )}
                        {progress && progress.fraction < 1 ? (
                          <View style={styles.progressRingWrap}>
                            <Text style={styles.progressRingText}>
                              {progress.current}/{progress.target}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[styles.gridTitle, !isUnlocked && styles.gridTitleLocked]}
                        numberOfLines={1}
                      >
                        {row.title}
                      </Text>
                      <Text style={styles.gridRarity}>{rarity}</Text>
                      {isEquipped ? <Text style={styles.equippedLabel}>Equipped</Text> : null}
                      {!isUnlocked ? (
                        <View style={styles.lockOverlay}>
                          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.list}>
                {rows.map((row) => (
                  <AchievementRowView key={row.slug} row={row} />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

function AchievementRowView({ row }: { row: AchievementRow }) {
  const art = ACHIEVEMENT_CATEGORY_ART[row.category];
  const badge = achievementArt(row.slug);
  const isLocked = row.state === 'locked';
  if (isLocked) {
    const strings = lockedRowStrings(row);
    return (
      <View style={[styles.row, styles.rowLocked]}>
        <View style={styles.emblem}>
          {badge ? (
            <Image
              source={badge}
              style={[
                styles.badge,
                { width: 56, height: 56, aspectRatio: 1, maxWidth: 56 },
                styles.badgeLocked,
              ]}
              contentFit="contain"
            />
          ) : (
            <Text style={styles.questionMark}>{strings[0]}</Text>
          )}
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
      {badge ? (
        <View style={styles.emblem}>
          <Image
            source={badge}
            style={[styles.badge, { width: 56, height: 56, aspectRatio: 1, maxWidth: 56 }]}
            contentFit="contain"
          />
        </View>
      ) : (
        <View style={[styles.emblem, { backgroundColor: art.blobColor }]}>
          <Ionicons name={art.icon} size={26} color={art.iconColor} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{strings[0]}</Text>
        <Text style={styles.rowDescription}>{strings[1]}</Text>
        <Text style={styles.rowDate}>{strings[2]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  backLabel: { color: colors.text, fontFamily: fonts.bodyBold.family, fontSize: 15 },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxxl, gap: spacing.xl },
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
  retryLabel: { color: colors.background, fontFamily: fonts.bodyBold.family, fontSize: 15 },
  header: { gap: spacing.xs },
  title: { color: colors.text, fontFamily: fonts.display.family, fontSize: 26 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body.family, fontSize: 14 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surfaceElevated },
  tabLabel: { color: colors.textMuted, fontFamily: fonts.bodyBold.family, fontSize: 14 },
  tabLabelActive: { color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridCell: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    position: 'relative',
  },
  gridCellEquipped: { borderWidth: 3 },
  gridEmblem: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridEmblemLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridBadge: { width: 56, height: 56, maxWidth: 56, maxHeight: 56, aspectRatio: 1 },
  badgeLocked: { opacity: 0.4 },
  questionMark: { color: colors.textMuted, fontFamily: fonts.display.family, fontSize: 26 },
  progressRingWrap: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  progressRingText: { color: colors.textMuted, fontFamily: fonts.bodyBold.family, fontSize: 10 },
  gridTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textAlign: 'center',
  },
  gridTitleLocked: { color: colors.textMuted },
  gridRarity: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  equippedLabel: { color: colors.reward, fontFamily: fonts.bodyBold.family, fontSize: 11 },
  lockOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 4,
  },
  list: { gap: spacing.md },
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
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 56,
    height: 56,
    maxWidth: 56,
    maxHeight: 56,
    aspectRatio: 1,
    borderRadius: radius.lg,
  },
  rowBody: { flex: 1, gap: spacing.xs, justifyContent: 'center' },
  rowTitle: { color: colors.text, fontFamily: fonts.bodyBold.family, fontSize: 16 },
  rowTitleLocked: { color: colors.textMuted },
  rowDescription: { color: colors.textMuted, fontFamily: fonts.body.family, fontSize: 14 },
  rowHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    fontStyle: 'italic',
  },
  rowDate: { color: colors.calmStrong, fontFamily: fonts.bodyBold.family, fontSize: 12 },
});

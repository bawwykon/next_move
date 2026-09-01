import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import { fetchCompletionHistory, type CompletionHistoryRow } from '@/data/repositories/history';
import { fetchProfileCosmetics } from '@/data/repositories/profileCosmetics';
import { supabase } from '@/data/supabase';
import { dayKey } from '@/domain/streak/dayKey';
import {
  ownedBySlug,
  validateEquip,
  DEFAULT_SLOT_SLUGS,
  type CosmeticSlot,
} from '@/domain/cosmetics/loadout';
import { achievementArt, cosmeticArt, masteryArt, nameplateArt } from '@/features/assets/assetMap';
import { withTapCue } from '@/lib/sounds';
import { LoadoutCard } from '@/features/profile/LoadoutCard';
import {
  historyLines,
  levelLine,
  masteryRows,
  streakCopy,
  streakMilestoneLine,
  xpBar,
  achievementsEntry,
  formatXp,
} from '@/features/profile/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

// AT-01E — per-frame ring-hole centers measured on the shipped PNGs (512
// canvas convention; the 1254 px frames normalize to it). The avatar sits in
// a 120 dp wrap; the frame image is positioned so its ring hole lands
// exactly on the wrap center (60,60), and each frame's box is sized so the
// ring clears the header card (the art moved from a high-hole to a centered
// ring, which no longer fits the old 280 dp box; ED-36 polish trims the
// default to 255 dp, and a later pass trims it 10% further to 229.5 dp).
// Unmeasured frames fall back to the canvas center + 280 dp until their art
// is measured.
const FRAME_HOLE_CENTER: Record<string, { x: number; y: number; size: number }> = {
  'frame-default': { x: 253.8, y: 251.66, size: 229.5 },
  'frame-level-05': { x: 255.8, y: 249.26, size: 176 },
  'frame-level-10': { x: 255.4, y: 258.86, size: 176 },
  'frame-level-25': { x: 232.3, y: 262.86, size: 176 },
  'frame-level-50': { x: 265.1, y: 265.86, size: 176 },
  'frame-level-75': { x: 256, y: 256, size: 176 },
  'frame-level-100': { x: 277.6, y: 269.86, size: 176 },
  premium_frame: { x: 256, y: 256, size: 155.23 },
};
const DEFAULT_HOLE_CENTER = { x: 256, y: 256, size: 176 };

// AT-02G — the profile card previews only the latest completions; the
// dedicated history screen owns paging through the full 30-day window.
const HISTORY_PREVIEW_COUNT = 4;

function frameAvatarStyle(slug: string | null): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const { x, y, size } = (slug && FRAME_HOLE_CENTER[slug]) || DEFAULT_HOLE_CENTER;
  return {
    left: 60 - (x / 512) * size,
    top: 60 - (y / 512) * size,
    width: size,
    height: size,
  };
}

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
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
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
        fetchCompletionHistory(user.id, { limit: HISTORY_PREVIEW_COUNT, offset: 0 }),
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
    setEarnedBadges((unlocksResult.data ?? []).map((u) => u.slug));
    setHistory(historyResult.data ?? []);
    setStatus('ready');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
    }, [loadFirstPage]),
  );

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
      // nameplate is stored as slug in DB; keep optimistic state as slug too so nameplateArt resolves
      const optimisticValue =
        slot === 'nameplate' && itemId
          ? (catalog.find((c) => c.id === itemId)?.slug ?? itemId)
          : itemId;
      setProfile((current) =>
        current
          ? { ...current, equipped: { ...current.equipped, [slot]: optimisticValue } }
          : current,
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

  const handleEquipBadges = useCallback(
    async (badges: string[]): Promise<string | null> => {
      if (!profile) return 'Not ready yet.';
      const previous = profile.equipped.badges;
      setProfile((current) =>
        current ? { ...current, equipped: { ...current.equipped, badges } } : current,
      );
      const { error } = await supabase
        .from('profiles')
        .update({ equipped_badges: badges } as never)
        .eq('id', profile.id);
      if (error) {
        setProfile((current) =>
          current ? { ...current, equipped: { ...current.equipped, badges: previous } } : current,
        );
        return 'Could not save badges.';
      }
      return null;
    },
    [profile],
  );

  const initials = email ? (email.split('@')[0] ?? '').slice(0, 2).toUpperCase() : 'A';
  const todayKey = dayKey(new Date());
  // AT-01D — resolve the equipped item ids to catalogue slugs for the art
  // lookup (a null id falls back to the slot's default slug when it has one).
  const equippedSlug = useCallback(
    (slot: CosmeticSlot): string | null => {
      const id = profile?.equipped?.[slot] ?? null;
      if (id) {
        return catalog.find((item) => item.id === id)?.slug ?? null;
      }
      return DEFAULT_SLOT_SLUGS[slot] ?? null;
    },
    [catalog, profile],
  );
  const portraitArt = equippedSlug('portrait') ? cosmeticArt(equippedSlug('portrait')) : null;
  const frameSlug = equippedSlug('frame');
  const frameArt = frameSlug ? cosmeticArt(frameSlug) : null;
  const rawNameplate = profile?.equipped?.nameplate ?? 'nameplate-default';
  // DB was slug; legacy rows / optimistic state may still be UUID — resolve via catalog if needed
  const nameplateSlug = (() => {
    if (rawNameplate.length === 36 && rawNameplate.includes('-')) {
      return catalog.find((c) => c.id === rawNameplate)?.slug ?? 'nameplate-default';
    }
    return rawNameplate;
  })();
  const nameplateSource = nameplateArt(nameplateSlug) ?? nameplateArt('nameplate-default');
  const hasNameplate = !!nameplateSource;
  const bar = useMemo(
    () => (profile ? xpBar(profile.totalXp, profile.level) : xpBar(0, 1)),
    [profile],
  );
  const streaks = useMemo(
    () => (profile ? streakCopy(profile.currentStreak, profile.longestStreak) : streakCopy(0, 0)),
    [profile],
  );
  // S9-02 — shared milestone countdown (same wording as the board pill).
  const milestoneLine = streakMilestoneLine(profile?.currentStreak ?? 0);
  const masteryRowsView = useMemo(() => masteryRows(mastery), [mastery]);
  const historyView = useMemo(() => historyLines(history, todayKey), [history, todayKey]);

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
            <View style={styles.header}>
              <View style={styles.avatarWrap}>
                {frameArt !== null ? (
                  // AT-01E — frame paints BEHIND the portrait; each frame
                  // image is positioned from its measured ring-hole center
                  // (see frameAvatarStyle) so the hole lands on the avatar.
                  <Image
                    source={frameArt}
                    style={[styles.avatarFrame, frameAvatarStyle(frameSlug)]}
                    contentFit="contain"
                    pointerEvents="none"
                    accessibilityLabel="Frame"
                  />
                ) : null}
                <View style={styles.avatar} accessibilityLabel={`Profile for ${email}`}>
                  {portraitArt !== null ? (
                    <Image
                      source={portraitArt}
                      style={styles.avatarImage}
                      contentFit="cover"
                      accessibilityLabel="Character portrait"
                    />
                  ) : (
                    <Text style={styles.initials}>{initials}</Text>
                  )}
                </View>
              </View>
              {/* PH3-01b — name frame + badge centered below name banner */}
              <View style={styles.nameFrameWrap}>
                <View style={[styles.nameFrame, hasNameplate && styles.nameFramePremium]}>
                  {hasNameplate ? (
                    <Image
                      source={nameplateSource!}
                      style={StyleSheet.absoluteFill}
                      contentFit="contain"
                    />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.7}
                    // @ts-expect-error — Android: removes extra font padding that pushes text low in leather panel
                    includeFontPadding={false}
                    textAlign="center"
                    style={[styles.name, hasNameplate && styles.namePremium, { zIndex: 1 }]}
                  >
                    {(
                      profile?.displayName ?? (email ? `Signed in as ${email}` : 'Your journey')
                    ).toUpperCase()}
                  </Text>
                </View>
                {profile?.equipped?.badges && profile.equipped.badges.length > 0 ? (
                  <View style={styles.badgeRow}>
                    {profile.equipped.badges.slice(0, 3).map((slug, index) => (
                      <View key={`${slug}-${index}`} style={styles.badgeSlot}>
                        <Image
                          source={achievementArt(slug) ?? undefined}
                          style={styles.badgeSlotImage}
                          contentFit="contain"
                        />
                      </View>
                    ))}
                  </View>
                ) : profile?.equipped?.badge ? (
                  <View style={styles.badgeRow}>
                    <View style={styles.badgeSlot}>
                      <Image
                        source={achievementArt(profile.equipped.badge) ?? undefined}
                        style={styles.badgeSlotImage}
                        contentFit="contain"
                      />
                    </View>
                  </View>
                ) : null}
              </View>
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
              {milestoneLine ? <Text style={styles.streakLongest}>{milestoneLine}</Text> : null}
            </View>

            {/* Mastery bars (FR-MAS-4). */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mastery</Text>
              <View style={styles.masteryList}>
                {masteryRowsView.map((row) => {
                  const icon = masteryArt(row.track);
                  return (
                    <View key={row.track} style={styles.masteryRow}>
                      <View style={styles.masteryLabels}>
                        <View style={styles.masteryLabelRow}>
                          {icon !== null ? (
                            <Image source={icon} style={styles.masteryIcon} contentFit="contain" />
                          ) : null}
                          <Text style={styles.masteryLabel}>{row.label}</Text>
                        </View>
                        <Text style={styles.masteryLevel}>
                          Lv {row.level} · {row.levelTitle}
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFillCalm, { width: `${row.fraction * 100}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Badges — the Achievements entry with a live count. */}
            <View style={styles.card}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.entryRow}
                onPress={withTapCue(() => router.push('/achievements'))}
              >
                <Ionicons name="trophy-outline" size={22} color={colors.reward} />
                <Text style={styles.entryLabel}>Achievements</Text>
                <Text style={styles.entryCount}>{achievementsEntry(earnedBadges.length)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Cosmetic loadout — FR-COS-1/2: tap a slot to open the picker. */}
            <LoadoutCard
              catalog={catalog}
              owned={owned}
              equipped={profile?.equipped ?? emptyEquipped}
              onEquip={handleEquip}
              onEquipBadges={handleEquipBadges}
              earnedBadges={earnedBadges}
            />

            {/* Quest history — last-4 preview; the full paged list lives on
                the dedicated history screen (AT-02G, FR-PROF-1). */}
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
              {historyView.length > 0 ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.viewAllRow}
                  onPress={withTapCue(() => router.push('/history'))}
                >
                  <Text style={styles.viewAllLabel}>View all history</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
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

const emptyEquipped = {
  frame: null,
  nameplate: null,
  portrait: null,
  badge: null,
  badges: [],
};

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
    overflow: 'hidden',
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  avatarWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFrame: {
    position: 'absolute',
    maxWidth: 229.5,
    maxHeight: 229.5,
    aspectRatio: 1,
    zIndex: 0,
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
    letterSpacing: 0.5,
  },
  nameFrameWrap: {
    alignSelf: 'center',
    marginTop: spacing.xs,
    position: 'relative',
  },
  nameFrame: {
    borderWidth: 2,
    borderColor: colors.rewardStrong,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 19.2,
    paddingVertical: 9.6,
    minWidth: 168,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  nameFramePremium: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    aspectRatio: 2.75,
    width: 240,
    maxWidth: 260,
    minWidth: 180,
    paddingHorizontal: 32,
    paddingVertical: 0,
  },
  namePremium: {
    color: '#FFF8E7', // warm soft cream/gold
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
    letterSpacing: 1.2,
    fontSize: 18,
    textAlign: 'center',
    width: '100%',
    transform: [{ translateY: -8 }],
  },
  badgeCentered: {
    alignSelf: 'center',
    marginTop: spacing.xs,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeCenteredImage: {
    width: 28,
    height: 28,
  },
  badgeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  badgeSlot: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeSlotImage: {
    width: 28,
    height: 28,
  },
  levelLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 16,
    marginTop: spacing.md,
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
    gap: 2,
  },
  masteryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  masteryIcon: {
    width: 30,
    height: 30,
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
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  viewAllLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  footer: {
    paddingTop: spacing.sm,
  },
});

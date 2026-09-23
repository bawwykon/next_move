import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  canClaimWorldQuests,
  canRerollObjective,
  doneWorldQuestCount,
  worldQuestWeekKey,
  type WorldQuestKey,
  type WorldQuestsWeek,
} from '@/domain/worldQuests/model';
import {
  claimWorldQuests,
  fetchWorldQuestsWeek,
  rerollWorldQuest,
} from '@/data/repositories/worldQuests';
import { WORLD_QUEST_MEDALLION } from '@/features/assets/assetMap';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { playCue, withTapCue } from '@/lib/sounds';

const OBJECTIVE_ICONS: Record<WorldQuestKey, keyof typeof Ionicons.glyphMap> = {
  wq_strength: 'barbell',
  wq_endurance: 'flame',
  wq_mobility: 'body',
  wq_discipline: 'shield',
  wq_any_3: 'apps',
  wq_days_3: 'calendar',
  wq_hard_1: 'trophy',
  wq_custom_1: 'hammer',
};

const OBJECTIVE_I18N_KEY: Record<WorldQuestKey, string> = {
  wq_strength: 'objStrength',
  wq_endurance: 'objEndurance',
  wq_mobility: 'objMobility',
  wq_discipline: 'objDiscipline',
  wq_any_3: 'objAny',
  wq_days_3: 'objDays',
  wq_hard_1: 'objHard',
  wq_custom_1: 'objCustom',
};

/**
 * JOURNEY-WORLD-QUESTS — 60px circle dock (bottom-right of the Journey map,
 * above the eye toggle) + slide-out weekly ledger. Self-contained: ensures
 * the current week's row on mount and whenever the parent's quest count moves
 * (completions are the only thing that can advance progress). All economy
 * (reroll/claim) rides the 0060 RPCs; this file only displays and confirms.
 */
export const WorldQuestsTab = memo(function WorldQuestsTab({
  journeyQuestCount,
}: {
  journeyQuestCount: number;
}) {
  const { t } = useTranslation();
  const [week, setWeek] = useState<WorldQuestsWeek | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [ledgerVisible, setLedgerVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    setToast(null);
    const result = await fetchWorldQuestsWeek(worldQuestWeekKey());
    if (result.error || !result.data) {
      setStatus('error');
      return;
    }
    // Late-week rollover: the row may belong to last Monday after a week
    // boundary passes mid-session — re-ensure for the fresh key instead of
    // showing a stale board.
    if (result.data.weekKey !== worldQuestWeekKey()) {
      const fresh = await fetchWorldQuestsWeek(worldQuestWeekKey());
      if (fresh.error || !fresh.data) {
        setStatus('error');
        return;
      }
      setWeek(fresh.data);
    } else {
      setWeek(result.data);
    }
    setStatus('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load, journeyQuestCount]);

  // Ledger opens always fetch fresh: completions landing while the ledger
  // sits closed (or a week boundary passing mid-session) must never show
  // stale progress behind the badge count.
  const openLedger = useCallback(() => {
    setLedgerVisible(true);
    void load();
  }, [load]);

  const done = week ? doneWorldQuestCount(week) : 0;
  const total = week?.objectives.length ?? 3;
  const readyToClaim = week ? canClaimWorldQuests(week) : false;

  const onReroll = useCallback(
    (index: number) => {
      if (!week || busy || !canRerollObjective(week, index)) {
        return;
      }
      // Arm busy BEFORE the confirm opens: rapid double-taps would otherwise
      // stack two Alerts whose confirms each spend one reroll (2→0 for what
      // looks like a single action). Cancel disarms; confirm stays armed
      // through the RPC. The server re-validates spares/claim/index, so a
      // stale week behind the Alert can only surface as a toast, never as
      // an extra decrement.
      setBusy(true);
      Alert.alert(
        t('journey.worldQuests.rerollTitle'),
        t('journey.worldQuests.rerollBody'),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
            onPress: () => setBusy(false),
          },
          {
            text: t('journey.worldQuests.rerollConfirm'),
            onPress: () => {
              void (async () => {
                const result = await rerollWorldQuest(week.weekKey, index);
                setBusy(false);
                if (result.error || !result.data) {
                  setToast(result.error ?? t('journey.worldQuests.loadError'));
                  return;
                }
                setWeek(result.data);
              })();
            },
          },
        ],
        // Android BACK dismisses the Alert without touching any button — without
        // this, `busy` would stick true and freeze reroll + claim until remount.
        { onDismiss: () => setBusy(false) },
      );
    },
    [week, busy, t],
  );

  const onClaim = useCallback(() => {
    if (!week || busy || !canClaimWorldQuests(week)) {
      return;
    }
    setBusy(true);
    void (async () => {
      const result = await claimWorldQuests(week.weekKey);
      if (result.error) {
        setBusy(false);
        setToast(result.error);
        return;
      }
      // SOUND-EFFECTS-UPGRADE — reward cue only after the server accepts the
      // claim (a failed RPC never celebrates).
      playCue('worldQuestComplete');
      const fresh = await fetchWorldQuestsWeek(week.weekKey);
      setBusy(false);
      if (!fresh.error && fresh.data) {
        setWeek(fresh.data);
      }
    })();
  }, [week, busy]);

  return (
    <>
      {/* Collapsed dock — scroll medallion + count pill, bottom-right above the eye toggle. */}
      <View style={styles.dock}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('journey.worldQuests.title')}
          style={[styles.dockBadge, readyToClaim ? styles.dockBadgeReady : null]}
          // 0.8 like the eye toggle below: the TouchableOpacity default (0.2)
          // faded the bright medallion to near-invisible on every press, which
          // read as a ~0.5s disappear/reappear. Still gives press feedback.
          activeOpacity={0.8}
          onPress={withTapCue(() => openLedger())}
        >
          {/* Never blank the dock once we hold a row: revalidation (every tap)
              runs behind the visible medallion. The spinner is only for the
              very first load (week === null); load errors surface inside the
              ledger, which keeps its own error branch. Previously the
              `status === 'loading'` check swapped the medallion for a spinner
              on every tap that followed a transient failure (error → loading
              for the ~1s RPC round trip) — the reported 1s disappear. */}
          {!week ? (
            <ActivityIndicator size="small" color={colors.reward} />
          ) : (
            <>
              <Image
                source={WORLD_QUEST_MEDALLION}
                style={styles.dockMedallion}
                contentFit="cover"
              />
              <View
                pointerEvents="none"
                style={[styles.dockCountPill, readyToClaim ? styles.dockCountPillReady : null]}
              >
                <Text style={[styles.dockCount, readyToClaim ? styles.dockCountReady : null]}>
                  {done}/{total}
                </Text>
                {readyToClaim ? (
                  <Ionicons name="checkmark" size={11} color={colors.background} />
                ) : null}
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Expanded parchment ledger */}
      <Modal
        visible={ledgerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLedgerVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          {/* Outside-tap dismiss (LoadoutCard / avatar-menu pattern): the
              backdrop went transparent per owner call, but without a Pressable
              outside taps fell through to the map instead of closing. Absolute
              fill behind the card; the card renders above so its own taps are
              unaffected. */}
          <Pressable style={styles.sheetDismissArea} onPress={() => setLedgerVisible(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeadings}>
                <Text style={styles.sheetTitle}>{t('journey.worldQuests.title')}</Text>
                <Text style={styles.sheetSubtitle}>{t('journey.worldQuests.subtitle')}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setLedgerVisible(false)}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {status === 'loading' || !week ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color={colors.reward} />
                <Text style={styles.quietLine}>{t('journey.worldQuests.loading')}</Text>
              </View>
            ) : status === 'error' ? (
              <View style={styles.centerBox}>
                <Text style={styles.quietLine}>{t('journey.worldQuests.loadError')}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.retryButton}
                  onPress={() => void load()}
                >
                  <Text style={styles.retryLabel}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {week.objectives.map((objective, index) => {
                  const met = objective.progress >= objective.goal;
                  const rerollable = canRerollObjective(week, index);
                  return (
                    <View key={`${objective.key}-${index}`} style={styles.objectiveRow}>
                      <Ionicons
                        name={OBJECTIVE_ICONS[objective.key]}
                        size={22}
                        color={met ? colors.success : colors.reward}
                      />
                      <View style={styles.objectiveBody}>
                        <Text style={styles.objectiveDesc} numberOfLines={2}>
                          {t(`journey.worldQuests.${OBJECTIVE_I18N_KEY[objective.key]}`, {
                            count: objective.goal,
                          })}
                        </Text>
                        <View style={styles.progressRow}>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${Math.round(
                                    Math.min(
                                      1,
                                      objective.goal > 0 ? objective.progress / objective.goal : 0,
                                    ) * 100,
                                  )}%`,
                                  backgroundColor: met ? colors.success : colors.reward,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.progressCount}>
                            {Math.min(objective.progress, objective.goal)} / {objective.goal}
                          </Text>
                        </View>
                      </View>
                      {met ? (
                        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                      ) : (
                        <TouchableOpacity
                          accessibilityRole="button"
                          disabled={!rerollable || busy}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={rerollable ? null : styles.rerollDisabled}
                          onPress={withTapCue(() => onReroll(index))}
                        >
                          <Ionicons
                            name="refresh"
                            size={22}
                            color={rerollable ? colors.reward : colors.surfaceElevated}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                <View style={styles.rewardBanner}>
                  <Ionicons name="trophy" size={26} color={colors.reward} />
                  <View style={styles.rewardBody}>
                    <Text style={styles.rewardText}>{t('journey.worldQuests.reward')}</Text>
                    <Text style={styles.rerollText}>
                      {t('journey.worldQuests.rerolls', { count: week.rerollsRemaining })}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.claimButton, readyToClaim ? null : styles.claimButtonDisabled]}
                  disabled={!readyToClaim || busy}
                  onPress={withTapCue(() => onClaim())}
                >
                  {week.claimed ? (
                    <Ionicons name="checkmark" size={18} color={colors.background} />
                  ) : null}
                  <Text style={styles.claimLabel}>
                    {week.claimed
                      ? t('journey.worldQuests.claimed')
                      : t('journey.worldQuests.claim')}
                  </Text>
                </TouchableOpacity>
                {toast !== null ? <Text style={styles.toast}>{toast}</Text> : null}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    end: spacing.lg,
    bottom: 206,
    zIndex: 12,
  },
  dockBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 26, 34, 0.95)',
    borderWidth: 1.5,
    borderColor: colors.rewardStrong,
  },
  dockBadgeReady: {
    borderColor: colors.reward,
  },
  dockMedallion: {
    width: 60,
    height: 60,
  },
  dockCountPill: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10, 13, 18, 0.92)',
    borderWidth: 1,
    borderColor: colors.rewardStrong,
  },
  dockCountPillReady: {
    backgroundColor: colors.reward,
    borderColor: colors.reward,
  },
  dockCount: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 10,
  },
  dockCountReady: {
    color: colors.background,
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Transparent like the chapter sheet (owner call): the map stays bright
    // and fully visible behind the ledger. The card itself stays opaque, so
    // readability is unaffected; X still closes.
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheetDismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(22, 26, 34, 0.98)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.rewardStrong,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetHeadings: { flex: 1, gap: 2 },
  sheetTitle: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  quietLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
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
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  objectiveBody: { flex: 1, gap: 6 },
  objectiveDesc: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
    lineHeight: 19,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  progressCount: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
    minWidth: 36,
    textAlign: 'right',
  },
  rerollDisabled: {
    opacity: 0.4,
  },
  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rewardStrong,
    padding: spacing.md,
  },
  rewardBody: { flex: 1, gap: 2 },
  rewardText: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  rerollText: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.reward,
    borderWidth: 2,
    borderColor: colors.rewardStrong,
  },
  claimButtonDisabled: {
    opacity: 0.45,
  },
  claimLabel: {
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 17,
  },
  toast: {
    color: colors.danger,
    fontFamily: fonts.body.family,
    fontSize: 12,
    textAlign: 'center',
  },
});

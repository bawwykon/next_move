import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { track } from '@/data/analytics';
import { questTitle } from '@/features/catalog/copy';
import { celebrateStep, initialCelebrationState } from '@/features/victory/celebration';
import { ChapterUnlockCelebration } from '@/features/journey/ChapterUnlockCelebration';
import { ConfettiBurst } from '@/features/victory/confetti';
import { BreakdownCard } from '@/features/victory/breakdown';
import { JourneyCard } from '@/features/victory/journey';
import { LevelUpOverlay } from '@/features/victory/levelUp';
import { MasteryCard } from '@/features/victory/mastery';
import { reconcileCompletion, unlockOverview } from '@/features/victory/format';
import { UnlocksCard } from '@/features/victory/unlocks';
import { colors, fonts, spacing } from '@/lib/theme';
import { playCue } from '@/lib/sounds';
import { useCompletionStore } from '@/state/completionStore';

/**
 * S6-01 — victory screen. Consumes completionStore.lastCompletion (S5-05)
 * and reconciles it against the quest we just finished; while the outbox
 * flush is still in flight the screen shows a calm "Syncing…" state with NO
 * XP/numbers (FR-XP-7 — the client never computes progression). Navigation is
 * replace-only, so Android back can never re-enter the finished workout
 * (Ref 04 rule 3).
 *
 * SOUND-EFFECTS-UPGRADE — staggered audio timeline (zero overlap when several
 * milestones land on one completion):
 *   t=0.0s  victoryFanfare   (3.0s)
 *   t=3.2s  levelup          (1.9s)  if leveledUp
 *   t=5.2s  chapterUnlocked  (3.5s)  if chapterAdvanced
 *   t=8.8s  masteryLevelup   (2.7s)  if any mastery rank rose
 * A tap-to-skip still suppresses every not-yet-fired beat.
 */

/** Audio beat offsets from the moment the authoritative payload lands (ms). */
const VICTORY_BEAT_MS = {
  fanfare: 0,
  levelUp: 3200,
  chapter: 5200,
  mastery: 8800,
} as const;
/** Level-up overlay hold — mirrors the levelup cue length. */
const LEVEL_UP_HOLD_MS = 1900;
/** Chapter overlay hold after its cue ends (owner: ~4s or tap-to-dismiss). */
const CHAPTER_HOLD_MS = 4000;

export default function VictoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    questId?: string;
    title?: string;
    slug?: string;
    source?: string;
  }>();
  const questId = params.questId;
  // BYQ-04 — custom quests label the breakdown's base row with their own name.
  const baseLabel =
    params.source === 'custom' && typeof params.title === 'string' && params.title.length > 0
      ? params.title
      : undefined;

  const lastCompletion = useCompletionStore((state) => state.lastCompletion);

  // S6-02 / FR-VIC-4 — the celebration queue lives in a pure reducer
  // (celebration.ts); the screen only feeds events. A tap anywhere skips the
  // whole queue to its final state, so the tap outruns any in-flight timer.
  const [celebration, dispatchCelebration] = useReducer(celebrateStep, initialCelebrationState);
  const skippedRef = useRef(false);
  const enterChimed = useRef(false);
  const levelUpRung = useRef(false);
  const chapterRung = useRef(false);
  const masteryRung = useRef(false);

  const reconciled = reconcileCompletion(lastCompletion, questId);
  const result = reconciled.result;
  const overview = result ? unlockOverview(result) : null;
  const leveledUp = result ? result.level.after > result.level.before : false;
  const chapterAdvanced = result
    ? result.journey.chapter_after > result.journey.chapter_before
    : false;
  // SOUND-EFFECTS-UPGRADE — any mastery track whose rank rose on this payout.
  const hasMasteryLevelUp = result
    ? result.mastery.some((row) => row.level_after > row.level_before)
    : false;

  // Once the authoritative payload lands: victory chime + the first confetti
  // burst, exactly once per visit.
  useEffect(() => {
    if (!result || enterChimed.current) {
      return;
    }
    enterChimed.current = true;
    playCue('victoryFanfare');
    dispatchCelebration('payload');
    // NFR-9 — each new unlock in this payload, exactly once per visit.
    for (const unlock of result.achievements) {
      void track('achievement_unlocked', { slug: unlock.slug });
    }
  }, [result]);

  // FR-XP-4 — level-up celebration, timed after the fanfare beat: a second
  // confetti run, the level-up chime, and the overlay flash. A tap-to-skip
  // (FR-VIC-4) suppresses the chime; the reducer then ignores the timed events.
  // AT-02D — when a chapter also advanced, the hide at the end of this beat is
  // suppressed so the chapter beat takes over the overlay (never both at once).
  // SOUND-EFFECTS-UPGRADE — fixed 3.2s beat so the fanfare always finishes first.
  useEffect(() => {
    if (!result || !leveledUp || levelUpRung.current) {
      return;
    }
    levelUpRung.current = true;
    // NFR-9 — level_up fires with the span the server reported.
    void track('level_up', { before: result.level.before, after: result.level.after });
    let active = true;
    const show = setTimeout(() => {
      if (!active || skippedRef.current) {
        return;
      }
      playCue('levelup');
      dispatchCelebration('level-up');
    }, VICTORY_BEAT_MS.levelUp);
    const hide = setTimeout(() => {
      if (active && !chapterAdvanced) {
        dispatchCelebration('hide');
      }
    }, VICTORY_BEAT_MS.levelUp + LEVEL_UP_HOLD_MS);
    return () => {
      active = false;
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [result, leveledUp, chapterAdvanced]);

  // AT-02D — chapter celebration: the chapter cue plays ALONE after the
  // level-up beat (overlap rule). The overlay holds ~4s or until a tap skips it
  // (owner amendment — no hard cut when the cue ends).
  // SOUND-EFFECTS-UPGRADE — fixed 5.2s beat, after levelup fully ends (3.2+1.9).
  useEffect(() => {
    if (!result || !chapterAdvanced || chapterRung.current) {
      return;
    }
    chapterRung.current = true;
    let active = true;
    const show = setTimeout(() => {
      if (!active || skippedRef.current) {
        return;
      }
      playCue('chapterUnlocked');
      dispatchCelebration('chapter');
    }, VICTORY_BEAT_MS.chapter);
    const hide = setTimeout(() => {
      if (active) {
        dispatchCelebration('hide');
      }
    }, VICTORY_BEAT_MS.chapter + CHAPTER_HOLD_MS);
    return () => {
      active = false;
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [result, chapterAdvanced]);

  // SOUND-EFFECTS-UPGRADE — final beat: mastery rank-up chime after the
  // chapter cue has fully ended (5.2 + 3.5 = 8.7s → fires at 8.8s). Cue only —
  // the MasteryCard is already on screen, so no extra overlay is needed.
  useEffect(() => {
    if (!result || !hasMasteryLevelUp || masteryRung.current) {
      return;
    }
    masteryRung.current = true;
    let active = true;
    const show = setTimeout(() => {
      if (!active || skippedRef.current) {
        return;
      }
      playCue('masteryLevelup');
    }, VICTORY_BEAT_MS.mastery);
    return () => {
      active = false;
      clearTimeout(show);
    };
  }, [result, hasMasteryLevelUp]);

  const skipCelebration = useCallback(() => {
    if (skippedRef.current) {
      return;
    }
    skippedRef.current = true;
    dispatchCelebration('skip');
  }, []);

  // JOURNEY-02 — the celebration overlay (auto-dismiss 2s / tap-early) feeds
  // the same 'hide' event as the fallback timer above; the reducer no-ops it
  // outside the chapter stage, so a double-dismiss is harmless.
  const handleChapterDismiss = useCallback(() => {
    dispatchCelebration('hide');
  }, []);

  const handleSkipPress = () => {
    skipCelebration();
  };

  const headline =
    questTitle(params.slug, params.title ?? null, t) ?? t('victory.headlineFallback');

  return (
    <Screen>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={handleSkipPress}>
            <View style={styles.header}>
              <Text style={styles.kicker}>{t('victory.kicker')}</Text>
              <Ionicons name="trophy" size={44} color={colors.reward} />
              <Text style={styles.title}>{headline}</Text>

              {result ? (
                <View style={styles.totalBlock}>
                  <Text style={styles.totalValue}>+{result.xp.total}</Text>
                  <Text style={styles.totalLabel}>{t('victory.xpEarned')}</Text>
                  {leveledUp ? (
                    <View style={styles.levelChip}>
                      <Ionicons name="arrow-up-circle" size={16} color={colors.background} />
                      <Text style={styles.levelChipText}>
                        {t('victory.levelChip', {
                          before: result.level.before,
                          after: result.level.after,
                          title: result.level.title,
                        })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.syncing}>
                  <View style={styles.syncingDot} />
                  <Text style={styles.syncingLabel}>{t('victory.syncing')}</Text>
                </View>
              )}
            </View>
          </Pressable>

          {result ? (
            <View style={styles.results}>
              <BreakdownCard xp={result.xp} baseLabel={baseLabel} />
              {result.mastery.length > 0 ? <MasteryCard rows={result.mastery} /> : null}
              <JourneyCard journey={result.journey} streak={result.streak.current} />
              {overview?.hasUnlocks ? <UnlocksCard overview={overview} /> : null}
            </View>
          ) : (
            <View style={styles.buffer}>
              <Text style={styles.bufferText}>{t('victory.bufferText')}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            label={t('victory.backToBoard')}
            variant="primary"
            onPress={() => router.replace('/')}
          />
        </View>
      </View>

      <ConfettiBurst runId={celebration.confettiRun} />
      <LevelUpOverlay
        visible={celebration.overlayVisible}
        level={result?.level.after ?? 1}
        title={result?.level.title ?? ''}
      />
      <ChapterUnlockCelebration
        visible={celebration.chapterOverlayVisible}
        chapterId={result?.journey.chapter_after ?? 1}
        onDismiss={handleChapterDismiss}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  kicker: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
    textAlign: 'center',
  },
  totalBlock: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  totalValue: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 48,
    lineHeight: 56,
  },
  totalLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.reward,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  levelChipText: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  syncing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  syncingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.calm,
  },
  syncingLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  results: {
    gap: spacing.lg,
  },
  buffer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  bufferText: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});

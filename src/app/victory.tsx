import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { ConfettiBurst } from '@/features/victory/confetti';
import { BreakdownCard } from '@/features/victory/breakdown';
import { JourneyCard } from '@/features/victory/journey';
import { LevelUpOverlay } from '@/features/victory/levelUp';
import { MasteryCard } from '@/features/victory/mastery';
import { reconcileCompletion, unlockOverview } from '@/features/victory/format';
import { UnlocksCard } from '@/features/victory/unlocks';
import { playOnce, useVictorySounds } from '@/features/victory/sounds';
import { colors, fonts, spacing } from '@/lib/theme';
import { useCompletionStore } from '@/state/completionStore';

/**
 * S6-01 — victory screen. Consumes completionStore.lastCompletion (S5-05)
 * and reconciles it against the quest we just finished; while the outbox
 * flush is still in flight the screen shows a calm "Syncing…" state with NO
 * XP/numbers (FR-XP-7 — the client never computes progression). Navigation is
 * replace-only, so Android back can never re-enter the finished workout
 * (Ref 04 rule 3).
 */
export default function VictoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ questId?: string; title?: string }>();
  const questId = params.questId;

  const lastCompletion = useCompletionStore((state) => state.lastCompletion);
  const { victory: victoryTrack, levelUp: levelUpTrack } = useVictorySounds();

  const [burstRun, setBurstRun] = useState(0);
  const [upVisible, setUpVisible] = useState(false);
  const enterChimed = useRef(false);
  const levelUpRung = useRef(false);

  const reconciled = reconcileCompletion(lastCompletion, questId);
  const result = reconciled.result;
  const overview = result ? unlockOverview(result) : null;
  const leveledUp = result ? result.level.after > result.level.before : false;

  // Once the authoritative payload lands: victory chime + the first confetti
  // burst, exactly once per visit.
  useEffect(() => {
    if (!result || enterChimed.current) {
      return;
    }
    enterChimed.current = true;
    playOnce(victoryTrack);
    setBurstRun((run) => run + 1);
  }, [result, victoryTrack]);

  // FR-XP-4 — level-up celebration, timed after the initial burst: a second
  // confetti run, the level-up chime, and the overlay flash.
  useEffect(() => {
    if (!result || !leveledUp || levelUpRung.current) {
      return;
    }
    levelUpRung.current = true;
    let active = true;
    const show = setTimeout(() => {
      if (!active) {
        return;
      }
      playOnce(levelUpTrack);
      setBurstRun((run) => run + 1);
      setUpVisible(true);
    }, 800);
    const hide = setTimeout(() => {
      if (active) {
        setUpVisible(false);
      }
    }, 800 + 1900);
    return () => {
      active = false;
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [result, leveledUp, levelUpTrack]);

  const headline = params.title ?? 'Great work!';

  return (
    <Screen>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Quest Complete</Text>
            <Ionicons name="trophy" size={44} color={colors.reward} />
            <Text style={styles.title}>{headline}</Text>

            {result ? (
              <View style={styles.totalBlock}>
                <Text style={styles.totalValue}>+{result.xp.total}</Text>
                <Text style={styles.totalLabel}>XP earned</Text>
                {leveledUp ? (
                  <View style={styles.levelChip}>
                    <Ionicons name="arrow-up-circle" size={16} color={colors.background} />
                    <Text style={styles.levelChipText}>
                      Level {result.level.before} → {result.level.after} · {result.level.title}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.syncing}>
                <View style={styles.syncingDot} />
                <Text style={styles.syncingLabel}>Syncing…</Text>
              </View>
            )}
          </View>

          {result ? (
            <View style={styles.results}>
              <BreakdownCard xp={result.xp} />
              {result.mastery.length > 0 ? <MasteryCard rows={result.mastery} /> : null}
              <JourneyCard journey={result.journey} streak={result.streak.current} />
              {overview?.hasUnlocks ? <UnlocksCard overview={overview} /> : null}
            </View>
          ) : (
            <View style={styles.buffer}>
              <Text style={styles.bufferText}>
                Your rewards are on their way — the server is settling the books. They appear the
                moment the sync lands.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            label="Back to Quest Board"
            variant="primary"
            onPress={() => router.replace('/')}
          />
        </View>
      </View>

      <ConfettiBurst runId={burstRun} />
      <LevelUpOverlay
        visible={upVisible}
        level={result?.level.after ?? 1}
        title={result?.level.title ?? ''}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
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

import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { colors, fonts, spacing } from '@/lib/theme';
import { useCharacterStore } from '@/state/characterStore';

const MASTERY_LABELS: Record<string, string> = {
  strength: 'Strength',
  endurance: 'Endurance',
  mobility: 'Mobility',
  discipline: 'Discipline',
};

export default function QuestBoardScreen() {
  const { profile, mastery, streak, fetchedAt, status, refresh } = useCharacterStore();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const streakLine =
    streak === null
      ? ''
      : streak.current > 0
        ? `${streak.current} day${streak.current === 1 ? '' : 's'} strong!`
        : 'Start your streak today';

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.appTitle}>Next Move</Text>
        {status === 'loading' ? <Text style={styles.subtitle}>Loading your quests…</Text> : null}
        {status === 'error' ? (
          <Text style={styles.subtitle}>Could not load your quest data.</Text>
        ) : null}
        {status === 'ready' ? (
          <View style={styles.card}>
            <Text style={styles.streak}>{streakLine}</Text>
            <Text style={styles.muted}>
              {profile?.displayName ?? 'Adventurer'} · Longest streak {streak?.longest ?? 0}
            </Text>
            {mastery && mastery.length > 0 ? (
              <Text style={styles.muted}>
                Mastery:{' '}
                {mastery
                  .map((row) => `${MASTERY_LABELS[row.track] ?? row.track} ${row.points}`)
                  .join(' · ')}
              </Text>
            ) : null}
            {fetchedAt ? (
              <Text style={styles.timestamp}>
                Synced {new Date(fetchedAt).toLocaleTimeString()}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  appTitle: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 32,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignSelf: 'stretch',
  },
  streak: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 28,
  },
  muted: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
    textAlign: 'center',
  },
  timestamp: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
    opacity: 0.7,
  },
});

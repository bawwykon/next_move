import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { colors, fonts, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

export default function QuestBoardScreen() {
  const signOut = useSessionStore((state) => state.signOut);

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>Quest Board</Text>
        <Text style={styles.subtitle}>Your daily quests live here — coming in S1-02.</Text>
      </View>
      <View style={styles.footer}>
        <AppButton label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
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
  footer: {
    paddingBottom: spacing.lg,
  },
});

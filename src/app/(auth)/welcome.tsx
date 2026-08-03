import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { colors, fonts, spacing } from '@/lib/theme';

export default function WelcomeScreen() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Next Move</Text>
        <Text style={styles.pitch}>Small quests. Real progress.</Text>
        <Text style={styles.body}>
          Turn daily steps and quick workouts into a game you actually want to play — one move at a
          time.
        </Text>
      </View>
      <View style={styles.actions}>
        <AppButton label="Get started" onPress={() => router.push('/(auth)/register')} />
        <AppButton
          label="I already have an account"
          variant="secondary"
          onPress={() => router.push('/(auth)/login')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 44,
  },
  pitch: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 20,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
});

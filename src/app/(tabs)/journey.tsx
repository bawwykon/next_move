import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { colors, fonts, spacing } from '@/lib/theme';

export default function JourneyScreen() {
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>Journey</Text>
        <Text style={styles.subtitle}>Your path is waiting — Chapter 1 of 7.</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
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
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  progressFill: {
    height: '100%',
    width: '0%',
    backgroundColor: colors.calm,
  },
});

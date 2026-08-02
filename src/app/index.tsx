import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/lib/theme';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Next Move</Text>
      <Text style={styles.subtitle}>Quest Board coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 40,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 16,
  },
});

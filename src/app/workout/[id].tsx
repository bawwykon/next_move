import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { colors, fonts, spacing } from '@/lib/theme';

/**
 * Ref 04 rule 2 — fullscreen workout shell (presentation: 'fullScreenModal').
 * The countdown engine and checkpoint packing land in S4.
 */
export default function WorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; title?: string }>();
  const title = params.title ?? 'Quest';

  return (
    <Screen>
      <View style={styles.content}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-down" size={24} color={colors.text} />
          <Text style={styles.backLabel}>Close</Text>
        </TouchableOpacity>

        <View style={styles.center}>
          <Ionicons name="timer-outline" size={56} color={colors.reward} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Timer arrives in S4.</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  backLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
    textAlign: 'center',
  },
});

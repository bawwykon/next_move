import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { colors, fonts, radius, spacing } from '@/lib/theme';

/**
 * Victory stub (S4-02). Reached by replace from the workout screen, so back
 * never re-enters a finished workout (Ref 04 rule 3). The real completion
 * pipeline (XP, streak, mastery) lands in S5/S6.
 */
export default function VictoryScreen() {
  const router = useRouter();
  const { questId } = useLocalSearchParams<{ questId?: string }>();

  return (
    <Screen>
      <View style={styles.center}>
        <Ionicons name="trophy" size={72} color={colors.reward} />
        <Text style={styles.title}>Quest Complete!</Text>
        <Text style={styles.sub}>Quest {questId ?? '—'}</Text>
        <Text style={styles.note}>Victory arrives in S6.</Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.button}
          onPress={() => router.replace('/quest-board')}
        >
          <Text style={styles.buttonLabel}>Back to Quest Board</Text>
        </TouchableOpacity>
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
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 30,
    textAlign: 'center',
  },
  sub: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
    textAlign: 'center',
  },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonLabel: {
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 17,
  },
});

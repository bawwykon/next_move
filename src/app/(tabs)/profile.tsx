import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

export default function ProfileScreen() {
  const router = useRouter();
  const email = useSessionStore((state) => state.session?.user?.email ?? '');
  const signOut = useSessionStore((state) => state.signOut);

  const initials = email ? (email.split('@')[0] ?? '').slice(0, 2).toUpperCase() : 'A';

  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.avatar} accessibilityLabel={`Profile for ${email}`}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <Text style={styles.level}>Level 1 Adventurer</Text>
        <Text style={styles.subtitle}>{email ? `Signed in as ${email}` : 'Not signed in'}</Text>
      </View>
      {/* S7-02 — entry to the Achievements screen; the rest of the profile
          stays the S3 stub until S8. */}
      <View style={styles.entryWrap}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.entryRow}
          onPress={() => router.push('/achievements')}
        >
          <Ionicons name="trophy-outline" size={22} color={colors.reward} />
          <Text style={styles.entryLabel}>Achievements</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
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
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 36,
  },
  level: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 18,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    textAlign: 'center',
  },
  entryWrap: {
    marginHorizontal: spacing.lg,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  entryLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});

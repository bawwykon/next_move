import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

export default function ProfileScreen() {
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
  footer: {
    paddingBottom: spacing.lg,
  },
});

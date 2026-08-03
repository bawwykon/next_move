import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { Screen } from '@/components/ui/Screen';
import { colors, fonts, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

export default function RegisterScreen() {
  const signUp = useSessionStore((state) => state.signUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError('Enter an email and a password to create your account.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Those passwords don\u2019t match — check them again.');
      return;
    }
    setBusy(true);
    setError(null);
    const message = await signUp(email.trim(), password);
    setBusy(false);
    if (message) {
      setError(message);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>One step to your first quest.</Text>
      </View>
      <View style={styles.form}>
        <AppTextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
        />
        <AppTextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoComplete="new-password"
        />
        <AppTextField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Type it once more"
          secureTextEntry
          autoComplete="new-password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton label="Create account" onPress={handleRegister} loading={busy} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/login')}
          style={styles.link}
        >
          <Text style={styles.linkText}>Sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 36,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 16,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  footerText: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
});

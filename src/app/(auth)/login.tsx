import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { Screen } from '@/components/ui/Screen';
import { postLoginRoute } from '@/lib/intended-route';
import { colors, fonts, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

export default function LoginScreen() {
  const signIn = useSessionStore((state) => state.signIn);
  const clearIntendedRoute = useSessionStore((state) => state.clearIntendedRoute);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password to sign in.');
      return;
    }
    setBusy(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    const intendedRoute = useSessionStore.getState().intendedRoute;
    clearIntendedRoute();
    router.replace(postLoginRoute(intendedRoute));
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to keep your streak alive.</Text>
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
          placeholder="Your password"
          secureTextEntry
          autoComplete="current-password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton label="Sign in" onPress={handleSignIn} loading={busy} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/forgot-password')}
          style={styles.link}
        >
          <Text style={styles.linkText}>Forgot your password?</Text>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>New here?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/register')}
          style={styles.link}
        >
          <Text style={styles.linkText}>Create an account</Text>
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
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
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
});

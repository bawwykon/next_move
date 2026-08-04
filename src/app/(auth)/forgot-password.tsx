import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/data/supabase';
import { RESET_REDIRECT_URL } from '@/lib/auth-redirect';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { colors, fonts, spacing } from '@/lib/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      setError('Enter your email so we know where to send the link.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT_URL,
    });
    setBusy(false);
    if (authError) {
      setError(getAuthErrorMessage(authError));
      return;
    }
    setSent(true);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          We&apos;ll email you a link to set a new one. It takes about a minute to arrive.
        </Text>
      </View>
      <View style={styles.form}>
        {sent ? (
          <Text style={styles.success}>Check your inbox — the reset link is on its way.</Text>
        ) : (
          <>
            <AppTextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <AppButton label="Send reset link" onPress={handleSend} loading={busy} />
          </>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/login')}
          style={styles.link}
        >
          <Text style={styles.linkText}>Back to sign in</Text>
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
    lineHeight: 24,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  success: {
    color: colors.success,
    fontFamily: fonts.body.family,
    fontSize: 16,
    lineHeight: 24,
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
});

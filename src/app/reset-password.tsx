import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/data/supabase';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { colors, fonts, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

type Phase = 'exchanging' | 'error' | 'form';

const MISSING_CODE_MESSAGE = 'This reset link is missing something — request a new one.';

export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const clearIntendedRoute = useSessionStore((state) => state.clearIntendedRoute);
  const rawCode = Array.isArray(code) ? code[0] : code;
  const missingCode = !rawCode;
  const [phase, setPhase] = useState<Phase>(missingCode ? 'error' : 'exchanging');
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (missingCode) {
      return;
    }
    void supabase.auth.exchangeCodeForSession(rawCode).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setError(getAuthErrorMessage(exchangeError));
        setPhase('error');
        return;
      }
      setPhase('form');
    });
  }, [rawCode, missingCode]);

  const handleSave = async () => {
    if (!newPassword) {
      setError('Enter a new password to continue.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Those passwords don\u2019t match — check them again.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (updateError) {
      setError(getAuthErrorMessage(updateError));
      return;
    }
    clearIntendedRoute();
    router.replace('/(tabs)/quest-board');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>
          {phase === 'form' ? 'Set a new password' : 'Reset your password'}
        </Text>
        <Text style={styles.subtitle}>
          {phase === 'form'
            ? 'Pick something you\u2019ll remember — and keep it yours.'
            : 'We\u2019re opening your reset link\u2026'}
        </Text>
      </View>
      <View style={styles.form}>
        {phase === 'exchanging' ? <ActivityIndicator size="large" color={colors.reward} /> : null}
        {phase === 'form' ? (
          <>
            <AppTextField
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoComplete="new-password"
            />
            <AppTextField
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Type it once more"
              secureTextEntry
              autoComplete="new-password"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <AppButton label="Save new password" onPress={handleSave} loading={busy} />
          </>
        ) : null}
        {phase === 'error' ? (
          <>
            <Text style={styles.error}>{missingCode ? MISSING_CODE_MESSAGE : error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(auth)/forgot-password')}
              style={styles.link}
            >
              <Text style={styles.linkText}>Request a new reset link</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(auth)/login')}
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
  error: {
    color: colors.danger,
    fontFamily: fonts.body.family,
    fontSize: 14,
    lineHeight: 22,
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

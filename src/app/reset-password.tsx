import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/data/supabase';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { withTapCue } from '@/lib/sounds';
import { colors, fonts, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

type Phase = 'exchanging' | 'error' | 'form';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
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
        setError(getAuthErrorMessage(exchangeError, t));
        setPhase('error');
        return;
      }
      setPhase('form');
    });
  }, [rawCode, missingCode, t]);

  const handleSave = async () => {
    if (!newPassword) {
      setError(t('auth.resetIntro'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (updateError) {
      setError(getAuthErrorMessage(updateError, t));
      return;
    }
    clearIntendedRoute();
    router.replace('/(tabs)/quest-board');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>
          {phase === 'form' ? t('auth.resetTitle') : t('auth.resetSubtitle')}
        </Text>
        <Text style={styles.subtitle}>
          {phase === 'form' ? t('auth.resetHint') : t('auth.resetting')}
        </Text>
      </View>
      <View style={styles.form}>
        {phase === 'exchanging' ? <ActivityIndicator size="large" color={colors.reward} /> : null}
        {phase === 'form' ? (
          <>
            <AppTextField
              label={t('auth.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t('auth.passwordHint')}
              secureTextEntry
              autoComplete="new-password"
            />
            <AppTextField
              label={t('auth.confirmNew')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('auth.confirmPlaceholder')}
              secureTextEntry
              autoComplete="new-password"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <AppButton label={t('auth.saveNew')} onPress={handleSave} loading={busy} />
          </>
        ) : null}
        {phase === 'error' ? (
          <>
            <Text style={styles.error}>{missingCode ? t('auth.resetBadLink') : error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/(auth)/forgot-password')}
              style={styles.link}
            >
              <Text style={styles.linkText}>{t('auth.resetRequestNew')}</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={withTapCue(() => router.replace('/(auth)/login'))}
          style={styles.link}
        >
          <Text style={styles.linkText}>{t('auth.backToSignIn')}</Text>
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

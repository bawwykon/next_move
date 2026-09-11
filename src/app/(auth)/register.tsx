import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { Screen } from '@/components/ui/Screen';
import { colors, fonts, spacing } from '@/lib/theme';
import { withTapCue } from '@/lib/sounds';
import { useSessionStore } from '@/state/sessionStore';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const signUp = useSessionStore((state) => state.signUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.registerEmptyError'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    const message = await signUp(email.trim(), password);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    // Session granted: the guard is still resolving profiles.onboarded,
    // which lands the user on /(onboarding) (Ref 04 line 27).
    router.replace('/(onboarding)');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.registerTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>
      </View>
      <View style={styles.form}>
        <AppTextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
        />
        <AppTextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordHint')}
          secureTextEntry
          autoComplete="new-password"
        />
        <AppTextField
          label={t('auth.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t('auth.confirmPlaceholder')}
          secureTextEntry
          autoComplete="new-password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton label={t('auth.createAccountCta')} onPress={handleRegister} loading={busy} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.haveAccount')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={withTapCue(() => router.push('/(auth)/login'))}
          style={styles.link}
        >
          <Text style={styles.linkText}>{t('auth.signIn')}</Text>
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

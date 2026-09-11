import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppTextField } from '@/components/ui/AppTextField';
import { Screen } from '@/components/ui/Screen';
import { postLoginRoute } from '@/lib/intended-route';
import { authErrorMessage } from '@/lib/auth-errors';
import { withTapCue } from '@/lib/sounds';
import { colors, fonts, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';

export default function LoginScreen() {
  const { t } = useTranslation();
  const signIn = useSessionStore((state) => state.signIn);
  const clearIntendedRoute = useSessionStore((state) => state.clearIntendedRoute);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.emptyError'));
      return;
    }
    setBusy(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setBusy(false);
    if (message) {
      setError(authErrorMessage(message, t));
      return;
    }
    const intendedRoute = useSessionStore.getState().intendedRoute;
    clearIntendedRoute();
    router.replace(postLoginRoute(intendedRoute));
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
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
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          autoComplete="current-password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton label={t('auth.signIn')} onPress={handleSignIn} loading={busy} />
        <Pressable
          accessibilityRole="button"
          onPress={withTapCue(() => router.push('/(auth)/forgot-password'))}
          style={styles.link}
        >
          <Text style={styles.linkText}>{t('auth.forgot')}</Text>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('auth.newHere')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={withTapCue(() => router.push('/(auth)/register'))}
          style={styles.link}
        >
          <Text style={styles.linkText}>{t('auth.createAccount')}</Text>
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

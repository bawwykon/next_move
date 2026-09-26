import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Constants from 'expo-constants';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/data/supabase';
import { applyLocale, loadSavedLocale } from '@/i18n';
import { APP_LOCALES, LOCALE_NAMES, type AppLocale } from '@/i18n/locales';
import { useTranslation } from 'react-i18next';
import {
  loadLocalSettings,
  saveLocalSettings,
  pushRemoteSettings,
} from '@/data/repositories/settings';
import { fetchCosmeticCatalog, type CosmeticRow } from '@/data/repositories/cosmetics';
import type { CharacterProfile } from '@/data/repositories/board';
import { DEFAULT_SETTINGS, type AppSettings } from '@/domain/settings/model';
import { playCue, setSoundFxEnabled, withTapCue } from '@/lib/sounds';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';
import { useCharacterStore } from '@/state/characterStore';
import { useCompletionStore } from '@/state/completionStore';
import { cosmeticArt } from '@/features/assets/assetMap';
import { chapterName } from '@/features/catalog/copy';
import { chapterDataById } from '@/features/journey/journeyData';
import { avatarDisplayUrl, formatXp, xpBar } from '@/features/profile/format';

// LayoutAnimation needs no experimental enable flag on the new architecture
// (Expo SDK 57 default) — calling
// UIManager.setLayoutAnimationEnabledExperimental only raises a LogBox
// deprecation warning, so it stays out.

function useChevronRotation(open: boolean): Animated.AnimatedInterpolation<string> {
  const [anim] = useState(() => new Animated.Value(open ? 1 : 0));
  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open, anim]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
}

function toggleWithSpring(setter: React.Dispatch<React.SetStateAction<boolean>>): void {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setter((current) => !current);
}

/**
 * SETTINGS-OVERHAUL — the RPG character menu: crest header, tappable player
 * profile card, grouped gold-bordered leather cards, inline Language/About
 * accordions with spring animation, safety modal, and a confirm-gated logout.
 * Every behavior underneath (toggles, locale apply, sync, export, sign-out)
 * rides the original handlers untouched.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const email = useSessionStore(
    (s: { session: { user: { email?: string } } | null }) => s.session?.user?.email ?? '',
  );
  const signOut = useSessionStore((s: { signOut: () => Promise<void> }) => s.signOut);
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [locale, setLocale] = useState<AppLocale>('en');
  const { t, i18n } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [catalog, setCatalog] = useState<CosmeticRow[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const langChevron = useChevronRotation(langOpen);
  const aboutChevron = useChevronRotation(aboutOpen);
  const version =
    ((Constants as unknown as { expoConfig?: { version?: string } }).expoConfig?.version as
      string | undefined) ?? '1.0.0';

  useEffect(() => {
    void (async () => {
      const local = await loadLocalSettings();
      setSettings(local);
      const savedLocale = await loadSavedLocale();
      setLocale(savedLocale ?? ((i18n.language as AppLocale) || 'en'));
    })();
  }, [i18n.language]);

  // Player card snapshot: cached character profile + cosmetic catalog for the
  // equipped portrait slug. Refreshed whenever Settings regains focus.
  const refreshProfile = useCallback(async () => {
    setProfileLoading(true);
    const store = useCharacterStore.getState();
    if (store.status === 'idle' || store.status === 'error') {
      await store.refresh();
    }
    const [catalogResult] = await Promise.all([fetchCosmeticCatalog()]);
    setProfile(useCharacterStore.getState().profile);
    setCatalog(catalogResult.data ?? []);
    setProfileLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );

  const portraitArt = (() => {
    const equippedId = profile?.equipped.portrait ?? null;
    const match = equippedId
      ? (catalog.find((row) => row.id === equippedId) ??
        catalog.find((row) => row.slug === equippedId) ??
        null)
      : null;
    return cosmeticArt(match?.slug ?? 'portrait-default');
  })();
  const photoUrl = avatarDisplayUrl(profile?.avatarUrl ?? null, 0);

  const updateToggle = useCallback(
    async (key: keyof AppSettings, value: boolean) => {
      const next = { ...settings, [key]: value };
      setSettings(next);
      await saveLocalSettings(next);
      if (key === 'soundFx') {
        setSoundFxEnabled(value);
      }
      if (key === 'soundFx' || key === 'haptics' || key === 'showExerciseArt') {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          void pushRemoteSettings(user.id, {
            soundFx: next.soundFx,
            haptics: next.haptics,
            showExerciseArt: next.showExerciseArt,
          });
        }
      }
      if (value && key === 'haptics') {
        void Haptics.selectionAsync().catch(() => undefined);
      }
    },
    [settings],
  );

  // I18N-01 — language switch. Same direction hot-swaps; LTR<->RTL reloads
  // (Android requirement) via applyLocale, so nothing else to do here.
  const onSelectLocale = useCallback(
    (next: AppLocale) => {
      if (next === locale) {
        toggleWithSpring(setLangOpen);
        return;
      }
      setLocale(next);
      toggleWithSpring(setLangOpen);
      void applyLocale(next);
    },
    [locale],
  );

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    await Promise.all([
      useCompletionStore.getState().hydrate(),
      useCompletionStore.getState().flush(),
      useCharacterStore.getState().refresh(),
    ]);
    setSyncing(false);
  }, []);

  const handleExport = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [profileRes, onboardingRes, completionsRes, masteryRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('onboarding').select('*').eq('profile_id', user.id).maybeSingle(),
      supabase
        .from('quest_completions')
        .select('quest_id, completed_at, day_key, xp_awarded')
        .eq('profile_id', user.id)
        .limit(200),
      supabase.from('mastery').select('*').eq('profile_id', user.id),
    ]);
    const exportData = {
      profile: profileRes.data,
      onboarding: onboardingRes.data,
      completions: completionsRes.data,
      mastery: masteryRes.data,
      exportedAt: new Date().toISOString(),
    };
    Alert.alert(t('settings.exportReady'), JSON.stringify(exportData, null, 2).slice(0, 4000));
  }, [t]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  }, [router, signOut]);

  const confirmLogout = useCallback(() => {
    Alert.alert(t('settings.logoutTitle'), t('settings.logoutHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logoutConfirm'),
        style: 'destructive',
        onPress: () => void handleLogout(),
      },
    ]);
  }, [t, handleLogout]);

  const handleDeleteAccount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // The avatar (0059 bucket) cannot be deleted by SQL — storage blocks direct
    // rows deletion — so remove it via the Storage API first; account deletion
    // proceeds regardless (worst case: one orphaned avatar file).
    await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountFailed'));
      return;
    }
    try {
      await signOut();
    } catch {
      // Session is already gone with the user row — local sign-out still follows.
    }
    router.replace('/(auth)/welcome');
  }, [router, signOut, t]);

  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAccountConfirm'),
        style: 'destructive',
        onPress: () => void handleDeleteAccount(),
      },
    ]);
  }, [t, handleDeleteAccount]);

  const chapterLabel = (() => {
    if (!profile) return '';
    const data = chapterDataById(profile.currentChapter);
    const localized = chapterName(profile.currentChapter, data?.name ?? '', t);
    const levelPart = t('settings.profileLevel', { n: Math.max(1, profile.level) });
    const chapterPart = t('settings.profileChapter', { n: profile.currentChapter });
    return localized
      ? `${levelPart} • ${chapterPart}: ${localized}`
      : `${levelPart} • ${chapterPart}`;
  })();
  const bar = profile ? xpBar(profile.totalXp, profile.level) : null;
  const displayName = profile?.displayName || email || '';

  return (
    <Screen>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Crest header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="settings-outline" size={24} color={colors.reward} />
              <View style={styles.headerTitles}>
                <Text style={styles.title}>{t('tabs.settings')}</Text>
                <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>
              </View>
            </View>
            <Ionicons name="shield" size={30} color={colors.reward} />
          </View>

          {/* Player profile summary → Profile tab */}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.profileCard}
            onPress={() => router.push('/(tabs)/profile')}
          >
            {profileLoading || !profile || !bar ? (
              <View style={styles.profileLoading}>
                <ActivityIndicator size="small" color={colors.reward} />
              </View>
            ) : (
              <View style={styles.profileInner}>
                <View style={styles.avatarRing}>
                  {photoUrl ? (
                    <Image
                      source={{ uri: photoUrl }}
                      style={styles.avatarImage}
                      contentFit="cover"
                    />
                  ) : portraitArt !== null ? (
                    <Image source={portraitArt} style={styles.avatarImage} contentFit="cover" />
                  ) : null}
                </View>
                <View style={styles.profileBody}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => router.push('/edit-profile')}
                    >
                      <Ionicons name="pencil" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.profileMeta} numberOfLines={2}>
                    {chapterLabel}
                  </Text>
                  <View style={styles.xpTrack}>
                    <View
                      style={[
                        styles.xpFill,
                        { width: `${Math.round(Math.min(1, Math.max(0, bar.fraction)) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.xpText}>
                    {t('profile.intoLevel', {
                      into: formatXp(bar.intoXp),
                      needed: formatXp(bar.neededXp),
                    })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.reward} />
              </View>
            )}
          </TouchableOpacity>

          {/* Account */}
          <SettingsCard>
            <TouchableOpacity style={styles.row} onPress={() => router.push('/edit-profile')}>
              <Ionicons name="person-outline" size={20} color={colors.reward} />
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{t('settings.account')}</Text>
                <Text style={styles.rowHint}>{t('settings.accountHint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </SettingsCard>

          {/* Sounds */}
          <SettingsCard>
            <View style={styles.toggleRow}>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{t('settings.soundFx')}</Text>
                <Text style={styles.rowHint}>{t('settings.soundFxHint')}</Text>
              </View>
              <Switch
                value={settings.soundFx}
                onValueChange={(v) => {
                  playCue('click');
                  void updateToggle('soundFx', v);
                }}
                trackColor={{ true: colors.reward }}
                thumbColor={colors.text}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{t('settings.haptics')}</Text>
                <Text style={styles.rowHint}>{t('settings.hapticsHint')}</Text>
              </View>
              <Switch
                value={settings.haptics}
                onValueChange={(v) => {
                  playCue('click');
                  void updateToggle('haptics', v);
                }}
                trackColor={{ true: colors.reward }}
                thumbColor={colors.text}
              />
            </View>
          </SettingsCard>

          {/* Workout & Gameplay */}
          <SettingsCard>
            <View style={styles.toggleRow}>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{t('settings.autoPause')}</Text>
                <Text style={styles.rowHint}>{t('settings.autoPauseHint')}</Text>
              </View>
              <Switch
                value={settings.autoPauseOnCall}
                onValueChange={(v) => {
                  playCue('click');
                  void updateToggle('autoPauseOnCall', v);
                }}
                trackColor={{ true: colors.reward }}
                thumbColor={colors.text}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{t('settings.showArt')}</Text>
                <Text style={styles.rowHint}>{t('settings.showArtHint')}</Text>
              </View>
              <Switch
                value={settings.showExerciseArt}
                onValueChange={(v) => {
                  playCue('click');
                  void updateToggle('showExerciseArt', v);
                }}
                trackColor={{ true: colors.reward }}
                thumbColor={colors.text}
              />
            </View>
          </SettingsCard>

          {/* Language accordion */}
          <SettingsCard>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.row}
              onPress={withTapCue(() => toggleWithSpring(setLangOpen))}
            >
              <Ionicons name="globe-outline" size={20} color={colors.reward} />
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{t('settings.language')}</Text>
                <Text style={styles.rowHint}>{LOCALE_NAMES[locale]}</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: langChevron }] }}>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Animated.View>
            </TouchableOpacity>
            {langOpen
              ? APP_LOCALES.map((option, index) => {
                  const active = option === locale;
                  return (
                    <View key={option}>
                      <View style={styles.divider} />
                      <TouchableOpacity
                        accessibilityRole="button"
                        style={styles.row}
                        onPress={withTapCue(() => onSelectLocale(option))}
                      >
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={active ? colors.reward : colors.textMuted}
                        />
                        <View style={styles.rowBody}>
                          <Text style={[styles.rowLabel, active ? styles.rowLabelActive : null]}>
                            {LOCALE_NAMES[option]}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })
              : null}
          </SettingsCard>

          {/* Data & Privacy */}
          <SettingsCard>
            <TouchableOpacity style={styles.row} onPress={() => void handleSyncNow()}>
              <Ionicons name="sync-outline" size={20} color={colors.textMuted} />
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>
                  {syncing ? t('settings.syncing') : t('settings.syncNow')}
                </Text>
                <Text style={styles.rowHint}>{t('settings.syncHint')}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => void handleExport()}>
              <Ionicons name="download-outline" size={20} color={colors.textMuted} />
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{t('settings.exportData')}</Text>
                <Text style={styles.rowHint}>{t('settings.exportHint')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </SettingsCard>

          {/* About accordion */}
          <SettingsCard>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.row}
              onPress={withTapCue(() => toggleWithSpring(setAboutOpen))}
            >
              <Ionicons name="information-circle-outline" size={20} color={colors.reward} />
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{t('settings.about')}</Text>
                <Text style={styles.rowHint}>{t('settings.aboutHint')}</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: aboutChevron }] }}>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Animated.View>
            </TouchableOpacity>
            {aboutOpen ? (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Ionicons name="pricetag-outline" size={20} color={colors.textMuted} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{t('settings.version')}</Text>
                    <Text style={styles.rowHint}>{version}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.row}
                  onPress={() => setSafetyVisible(true)}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{t('settings.safetyTitle')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    Linking.openURL(
                      'https://github.com/bawwykon/auryond/blob/main/assets/CREDITS.md',
                    ).catch(() => undefined)
                  }
                >
                  <Ionicons name="library-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.rowLabel}>{t('settings.credits')}</Text>
                  <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    Linking.openURL('https://bawwykon.github.io/auryond/privacy').catch(
                      () => undefined,
                    )
                  }
                >
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.rowLabel}>{t('settings.dataPrivacy')}</Text>
                  <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    Linking.openURL('mailto:ibrahimaljabrix@gmail.com').catch(() => undefined)
                  }
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.rowLabel}>{t('settings.support')}</Text>
                  <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </>
            ) : null}
          </SettingsCard>

          {/* Danger zone */}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.dangerCard}
            onPress={() => confirmLogout()}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <View style={styles.rowBody}>
              <Text style={[styles.rowLabel, { color: colors.danger }]}>
                {t('settings.logout')}
              </Text>
              <Text style={styles.rowHint}>{t('settings.logoutHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.danger} />
          </TouchableOpacity>

          {/* Delete account — permanent, double-confirmed */}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.dangerCard}
            onPress={() => confirmDeleteAccount()}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <View style={styles.rowBody}>
              <Text style={[styles.rowLabel, { color: colors.danger }]}>
                {t('settings.deleteAccount')}
              </Text>
              <Text style={styles.rowHint}>{t('settings.deleteAccountHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.danger} />
          </TouchableOpacity>

          <View style={styles.footer} />
        </ScrollView>
      </View>

      {/* Safety disclaimer modal */}
      <Modal
        visible={safetyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSafetyVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>{t('settings.safetyTitle')}</Text>
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetBody}>{t('settings.safetyText')}</Text>
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.sheetClose}
              onPress={() => setSafetyVisible(false)}
            >
              <Text style={styles.sheetCloseLabel}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const SettingsCard = memo(function SettingsCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
});

const GOLD_BORDER = colors.rewardStrong;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitles: { gap: 2 },
  title: { color: colors.text, fontFamily: fonts.display.family, fontSize: 28 },
  subtitle: { color: colors.reward, fontFamily: fonts.bodyBold.family, fontSize: 13 },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    padding: spacing.lg,
  },
  profileLoading: {
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: GOLD_BORDER,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileBody: { flex: 1, gap: 4 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileName: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 18,
    flexShrink: 1,
  },
  profileMeta: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  xpTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginTop: 4,
  },
  xpFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
  },
  xpText: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.danger,
    padding: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { color: colors.text, fontFamily: fonts.bodyBold.family, fontSize: 15 },
  rowLabelActive: { color: colors.reward },
  rowHint: { color: colors.textMuted, fontFamily: fonts.body.family, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.surfaceElevated },
  footer: { height: spacing.xl },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 20,
    textAlign: 'center',
  },
  sheetScroll: { maxHeight: 320 },
  sheetBody: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    lineHeight: 22,
  },
  sheetClose: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
});

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/data/supabase';
import {
  loadLocalSettings,
  saveLocalSettings,
  pushRemoteSettings,
} from '@/data/repositories/settings';
import { DEFAULT_SETTINGS, type AppSettings } from '@/domain/settings/model';
import { withTapCue } from '@/lib/sounds';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { useSessionStore } from '@/state/sessionStore';
import { useCharacterStore } from '@/state/characterStore';
import { useCompletionStore } from '@/state/completionStore';

const SAFETY_DISCLAIMER =
  'NextMove is for informational purposes only and is not intended to replace professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read in this app. If you think you may have a medical emergency, call your doctor or emergency services immediately. NextMove does not recommend or endorse any specific tests, physicians, products, procedures, opinions, or other information that may be mentioned in the app.';

export default function SettingsScreen() {
  const router = useRouter();
  const email = useSessionStore(
    (s: { session: { user: { email?: string } } | null }) => s.session?.user?.email ?? '',
  );
  const signOut = useSessionStore((s: { signOut: () => Promise<void> }) => s.signOut);
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [syncing, setSyncing] = useState(false);
  const version =
    ((Constants as unknown as { expoConfig?: { version?: string } }).expoConfig?.version as
      string | undefined) ?? '1.0.0';

  useEffect(() => {
    void (async () => {
      const local = await loadLocalSettings();
      setSettings(local);
    })();
  }, []);

  const updateToggle = useCallback(
    async (key: keyof AppSettings, value: boolean) => {
      const next = { ...settings, [key]: value };
      setSettings(next);
      await saveLocalSettings(next);
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
    Alert.alert('Export ready', JSON.stringify(exportData, null, 2).slice(0, 4000));
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  }, [router, signOut]);

  return (
    <Screen>
      <View style={styles.screen}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={withTapCue(() => router.back())}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Settings</Text>

          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={withTapCue(() => router.push('/edit-profile'))}
              >
                <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Display Name</Text>
                  <Text style={styles.rowHint}>Change how you appear</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Email</Text>
                  <Text style={styles.rowHint}>{email || '—'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.row}
                onPress={withTapCue(() => router.push('/reset-password'))}
              >
                <Ionicons name="key-outline" size={20} color={colors.textMuted} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Password</Text>
                  <Text style={styles.rowHint}>Reset your password</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={withTapCue(() => void handleLogout())}>
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                <Text style={[styles.rowLabel, { color: colors.danger }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Gameplay */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gameplay</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Sound FX</Text>
                  <Text style={styles.rowHint}>Tap and victory sounds</Text>
                </View>
                <Switch
                  value={settings.soundFx}
                  onValueChange={(v) => void updateToggle('soundFx', v)}
                  trackColor={{ true: colors.reward }}
                  thumbColor={colors.text}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Haptics</Text>
                  <Text style={styles.rowHint}>Vibration feedback</Text>
                </View>
                <Switch
                  value={settings.haptics}
                  onValueChange={(v) => void updateToggle('haptics', v)}
                  trackColor={{ true: colors.reward }}
                  thumbColor={colors.text}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Auto-Pause on Call</Text>
                  <Text style={styles.rowHint}>Pause workout on incoming call</Text>
                </View>
                <Switch
                  value={settings.autoPauseOnCall}
                  onValueChange={(v) => void updateToggle('autoPauseOnCall', v)}
                  trackColor={{ true: colors.reward }}
                  thumbColor={colors.text}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Show Exercise Art</Text>
                  <Text style={styles.rowHint}>Illustrations during workouts</Text>
                </View>
                <Switch
                  value={settings.showExerciseArt}
                  onValueChange={(v) => void updateToggle('showExerciseArt', v)}
                  trackColor={{ true: colors.reward }}
                  thumbColor={colors.text}
                />
              </View>
            </View>
          </View>

          {/* Data & Privacy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data & Privacy</Text>
            <View style={styles.card}>
              <TouchableOpacity style={styles.row} onPress={withTapCue(() => void handleSyncNow())}>
                <Ionicons name="sync-outline" size={20} color={colors.textMuted} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{syncing ? 'Syncing…' : 'Sync Now'}</Text>
                  <Text style={styles.rowHint}>Push pending completions</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={withTapCue(() => void handleExport())}>
                <Ionicons name="download-outline" size={20} color={colors.textMuted} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Export My Data</Text>
                  <Text style={styles.rowHint}>Download your profile as JSON</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>Version</Text>
                  <Text style={styles.rowHint}>{version}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.disclaimerWrap}>
                <Text style={styles.disclaimerTitle}>Safety Disclaimer</Text>
                <Text style={styles.disclaimerText}>{SAFETY_DISCLAIMER}</Text>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  Linking.openURL('https://example.com/credits').catch(() => undefined)
                }
              >
                <Ionicons name="library-outline" size={20} color={colors.textMuted} />
                <Text style={styles.rowLabel}>Credits & Licenses</Text>
                <Ionicons name="open-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.row}
                onPress={() =>
                  Linking.openURL('mailto:support@nextmove.app').catch(() => undefined)
                }
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.textMuted} />
                <Text style={styles.rowLabel}>Support & Feedback</Text>
                <Ionicons name="open-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer} />
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  backLabel: { color: colors.text, fontFamily: fonts.bodyBold.family, fontSize: 16 },
  content: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  title: { color: colors.text, fontFamily: fonts.display.family, fontSize: 28 },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { color: colors.text, fontFamily: fonts.bodyBold.family, fontSize: 15 },
  rowHint: { color: colors.textMuted, fontFamily: fonts.body.family, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.surfaceElevated },
  disclaimerWrap: { gap: spacing.xs },
  disclaimerTitle: { color: colors.text, fontFamily: fonts.bodyBold.family, fontSize: 14 },
  disclaimerText: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: { height: spacing.xl },
});

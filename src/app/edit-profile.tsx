import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/data/supabase';
import { withTapCue } from '@/lib/sounds';
import { colors, fonts, radius, spacing } from '@/lib/theme';

const NAME_MAX = 16;

/**
 * PH3-01a — dedicated profile editor. The name lives here now; future
 * sections (title/portrait/frame pickers) hang off this same screen.
 */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [nameDraft, setNameDraft] = useState('');
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill once per focus from the server row (view mode is the screen you
  // came from; this screen IS edit mode).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data) {
        const name = data.display_name ?? '';
        setLoadedName(name);
        setNameDraft(name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = nameDraft.trim() !== (loadedName ?? '');

  const handleSave = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t('editProfile.needSignIn'));
      setSaving(false);
      return;
    }
    const trimmed = nameDraft.trim().slice(0, NAME_MAX);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed || 'Adventurer' })
      .eq('id', user.id);
    if (updateError) {
      setError(t('editProfile.saveFailed'));
      setSaving(false);
      return;
    }
    setSaving(false);
    router.back();
  };

  return (
    <Screen>
      <View style={styles.screen}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={withTapCue(() => router.back())}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{t('editProfile.title')}</Text>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('editProfile.displayName')}</Text>
            <TextInput
              value={nameDraft}
              onChangeText={(text) => setNameDraft(text.slice(0, NAME_MAX))}
              placeholder={t('editProfile.placeholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={NAME_MAX}
              returnKeyType="done"
              style={styles.nameInput}
            />
            <Text style={styles.hint}>{t('editProfile.hint')}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            label={t('common.save')}
            onPress={() => void handleSave()}
            disabled={!dirty}
            loading={saving}
          />
          <AppButton
            label={t('common.cancel')}
            variant="secondary"
            onPress={withTapCue(() => router.back())}
          />
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  backLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
  },
  content: {
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 28,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  nameInput: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
});

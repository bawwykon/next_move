import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { RealJourneyMap } from '@/features/journey/RealJourneyMap';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { withTapCue } from '@/lib/sounds';
import { useCharacterStore } from '@/state/characterStore';
import { useFocusEffect } from 'expo-router';

export default function JourneyScreen() {
  const { t } = useTranslation();
  const { profile, status, refresh } = useCharacterStore();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const quests = profile?.journeyQuestCount ?? 0;

  if (status === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t('journey.errorTitle')}</Text>
          <Text style={styles.errorLine}>{t('journey.errorLine')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.retryButton}
            onPress={withTapCue(() => void refresh())}
          >
            <Text style={styles.retryLabel}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // Edge-to-edge container: no padding, fills entire screen area above tab bar
  return (
    <View style={styles.fullscreenContainer}>
      <RealJourneyMap
        journeyQuestCount={quests}
        refreshing={status === 'loading'}
        onRefresh={() => void refresh()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#0F1216',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  errorTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 22,
    textAlign: 'center',
  },
  errorLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
});

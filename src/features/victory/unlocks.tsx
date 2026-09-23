import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ComponentProps } from 'react';

import type { UnlockOverview } from '@/features/victory/format';
import {
  achievementCategory,
  achievementTitle,
  cosmeticName,
  cosmeticType,
} from '@/features/catalog/copy';
import { playCue } from '@/lib/sounds';
import { colors, fonts, radius, spacing } from '@/lib/theme';

interface UnlocksCardProps {
  overview: UnlockOverview;
}

type CosmeticIconName = ComponentProps<typeof Ionicons>['name'];

/**
 * One icon per cosmetic type so a multi-unlock row never reads as copies of
 * the same sparkle: a frame looks like a frame, a title like text, a
 * nameplate like a card, a portrait like a face. Unknown types keep the old
 * sparkle fallback. Color stays calm for the whole group (achievements own
 * the gold), so type reads by shape, not hue.
 */
const COSMETIC_ICONS: Record<string, CosmeticIconName> = {
  frame: 'image-outline',
  title: 'text-outline',
  nameplate: 'card-outline',
  portrait: 'person-circle-outline',
  background: 'color-palette-outline',
};

/**
 * S6-01 — unlock grouping: achievements and cosmetics each get their own
 * section so freshly earned entitlements read clearly apart from the XP.
 * Renders nothing when this completion unlocked nothing.
 */
export function UnlocksCard({ overview }: UnlocksCardProps) {
  const { t } = useTranslation();
  if (!overview.hasUnlocks) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('victory.unlocked')}</Text>

      {overview.achievements.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{t('victory.achievementsGroup')}</Text>
          {overview.achievements.map((unlock) => (
            // SOUND-EFFECTS-UPGRADE — tapping an earned achievement replays its
            // unlock cue (works any time after the staggered victory beats).
            <TouchableOpacity
              key={unlock.id}
              accessibilityRole="button"
              style={styles.row}
              onPress={() => playCue('achievementUnlocked')}
            >
              <Ionicons name="trophy-outline" size={20} color={colors.reward} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowName}>{achievementTitle(unlock.slug, unlock.title, t)}</Text>
                <Text style={styles.rowMeta}>{achievementCategory(unlock.category, t)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {overview.cosmetics.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{t('victory.cosmeticsGroup')}</Text>
          {overview.cosmetics.map((unlock) => (
            <View key={unlock.id} style={styles.row}>
              <Ionicons
                name={COSMETIC_ICONS[unlock.type] ?? 'sparkles-outline'}
                size={20}
                color={colors.calm}
              />
              <View style={styles.rowCopy}>
                <Text style={styles.rowName}>
                  {cosmeticName(unlock.slug, unlock.name, t) ?? unlock.name}
                </Text>
                <Text style={styles.rowMeta}>{cosmeticType(unlock.type, t)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: 1,
  },
  rowName: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  rowMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
});

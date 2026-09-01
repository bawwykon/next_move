import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { CosmeticRow } from '@/data/repositories/cosmetics';
import { catalogBySlot, DEFAULT_SLOT_SLUGS, type CosmeticSlot } from '@/domain/cosmetics/loadout';
import { achievementArt, cosmeticArt, nameplateArt } from '@/features/assets/assetMap';
import { pickerRowStrings } from '@/features/profile/format';
import { withTapCue } from '@/lib/sounds';
import { colors, fonts, radius, spacing } from '@/lib/theme';

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  frame: 'Frame',
  nameplate: 'Nameplate',
  portrait: 'Portrait',
};

const LEVEL_LABEL_BY_SLUG: Record<string, string> = {
  'frame-default': 'Always available',
  'frame-level-05': 'Lv 5',
  'frame-level-10': 'Lv 10',
  'frame-level-25': 'Lv 25',
  'frame-level-50': 'Lv 50',
  'frame-level-75': 'Lv 75',
  'frame-level-100': 'Lv 100',
  premium_frame: 'Purchase',
  'nameplate-default': 'Lv 1',
  'nameplate-level-05': 'Lv 5',
  'nameplate-level-10': 'Lv 10',
  'nameplate-level-25': 'Lv 25',
  'nameplate-level-50': 'Lv 50',
  'nameplate-level-75': 'Lv 75',
  'nameplate-level-100': 'Lv 100',
  'premium-nameplate': 'Purchase',
  premium_nameplate: 'Purchase',
  'portrait-default': 'Always available',
  'portrait-phoenix': 'Lv 25',
  'portrait-pathfinder': 'Lv 45',
  'portrait-warden': 'Lv 65',
  'portrait-master': 'Lv 100',
  premium_portrait: 'Purchase',
};

export interface LoadoutCardProps {
  catalog: readonly CosmeticRow[];
  owned: ReadonlySet<string>;
  equipped: {
    frame: string | null;
    nameplate: string | null;
    portrait: string | null;
    badges: string[];
  };
  onEquip: (slot: CosmeticSlot, itemId: string | null) => Promise<string | null>;
  onEquipBadges: (badges: string[]) => Promise<string | null>;
  earnedBadges: string[];
}

function slotValue(
  equipped: { frame: string | null; nameplate: string | null; portrait: string | null },
  slot: CosmeticSlot,
  items: readonly CosmeticRow[],
): string {
  const id = equipped[slot];
  if (id === null) {
    const defaultSlug = DEFAULT_SLOT_SLUGS[slot];
    return defaultSlug
      ? (items.find((item) => item.slug === defaultSlug)?.name ?? 'Default')
      : 'Default';
  }
  const byId = items.find((item) => item.id === id);
  if (byId) return byId.name;
  const bySlug = items.find((item) => item.slug === id);
  if (bySlug) return bySlug.name;
  return 'Default';
}

export function LoadoutCard({
  catalog,
  owned,
  equipped,
  onEquip,
  onEquipBadges,
  earnedBadges,
}: LoadoutCardProps) {
  const [openSlot, setOpenSlot] = useState<CosmeticSlot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [tempBadges, setTempBadges] = useState<string[]>(equipped.badges);

  const bySlot = catalogBySlot(catalog, owned);

  const open = (slot: CosmeticSlot) => {
    setOpenSlot(slot);
    setSelected(equipped[slot]);
    setError(null);
  };

  const close = () => {
    if (!saving) {
      setOpenSlot(null);
    }
  };

  const save = async () => {
    if (openSlot === null || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    const message = await onEquip(openSlot, selected);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setOpenSlot(null);
  };

  const openBadges = () => {
    setTempBadges([...equipped.badges]);
    setBadgeModalOpen(true);
    setError(null);
  };

  const closeBadges = () => {
    if (!saving) {
      setBadgeModalOpen(false);
    }
  };

  const toggleBadge = (slug: string) => {
    setTempBadges((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, slug];
    });
  };

  const saveBadges = async () => {
    setSaving(true);
    setError(null);
    const message = await onEquipBadges(tempBadges);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setBadgeModalOpen(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Loadout</Text>
        <Text style={styles.cardHint}>Tap a slot to change it</Text>
      </View>
      <View style={styles.loadoutList}>
        {(Object.keys(SLOT_LABELS) as CosmeticSlot[]).map((slot) => (
          <TouchableOpacity
            key={slot}
            accessibilityRole="button"
            style={styles.loadoutRow}
            onPress={withTapCue(() => open(slot))}
          >
            <Text style={styles.loadoutSlot}>{SLOT_LABELS[slot]}</Text>
            <Text style={styles.loadoutName}>{slotValue(equipped, slot, catalog)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.loadoutRow}
          onPress={withTapCue(openBadges)}
        >
          <Text style={styles.loadoutSlot}>Badges</Text>
          <Text style={styles.loadoutName}>
            {equipped.badges.length > 0 ? `${equipped.badges.length} equipped` : 'None'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Nameplate / Frame / Portrait picker modal */}
      <Modal visible={openSlot !== null} transparent animationType="slide" onRequestClose={close}>
        {openSlot !== null ? (
          <View style={styles.sheetBackdrop}>
            <Pressable style={styles.sheetDismissArea} onPress={withTapCue(close)} />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{SLOT_LABELS[openSlot]}</Text>

              {openSlot !== 'nameplate' && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.optionRow}
                  disabled={saving}
                  onPress={withTapCue(() => setSelected(null))}
                >
                  <Ionicons
                    name={selected === null ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={selected === null ? colors.reward : colors.textMuted}
                  />
                  <Text style={styles.optionLabel}>Default</Text>
                  <Text style={styles.optionMeta}>Always available</Text>
                </TouchableOpacity>
              )}

              {bySlot[openSlot].map((item) => {
                const strings = pickerRowStrings(item);
                const locked = !item.owned;
                const art =
                  openSlot === 'nameplate' ? nameplateArt(item.slug) : cosmeticArt(item.slug);
                return (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="button"
                    disabled={locked || saving}
                    style={styles.optionRow}
                    onPress={withTapCue(() => setSelected(item.id))}
                  >
                    {locked ? (
                      <Text style={styles.lockEmblem}>{strings[0]}</Text>
                    ) : art !== null ? (
                      <Image
                        source={art}
                        style={[
                          styles.optionThumb,
                          selected === item.id && styles.optionThumbSelected,
                        ]}
                        contentFit="contain"
                      />
                    ) : (
                      <Ionicons
                        name={selected === item.id ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={selected === item.id ? colors.reward : colors.textMuted}
                      />
                    )}
                    <Text style={[styles.optionLabel, locked && styles.optionLocked]}>
                      {strings[strings.length - 1]}
                    </Text>
                    <Text style={styles.optionMeta}>
                      {(() => {
                        const lvl = LEVEL_LABEL_BY_SLUG[item.slug];
                        if (!lvl) return locked ? 'Locked — keep going to earn it' : '';
                        return locked ? `${lvl} • Locked` : lvl;
                      })()}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {error ? <Text style={styles.errorLine}>{error}</Text> : null}

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.cancelButton}
                  disabled={saving}
                  onPress={withTapCue(close)}
                >
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  disabled={saving}
                  onPress={withTapCue(() => void save())}
                >
                  <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* Badge picker modal */}
      <Modal
        visible={badgeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeBadges}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetDismissArea} onPress={withTapCue(closeBadges)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Badges</Text>
            <Text style={styles.badgeHint}>Select up to 3 badges to display on your profile.</Text>

            <View style={styles.badgePreviewRow}>
              {[0, 1, 2].map((i) => {
                const slug = tempBadges[i];
                const art = slug ? achievementArt(slug) : null;
                return (
                  <View
                    key={i}
                    style={[styles.badgePreviewSlot, slug && styles.badgePreviewActive]}
                  >
                    {art ? (
                      <Image source={art} style={styles.badgePreviewImage} contentFit="contain" />
                    ) : null}
                  </View>
                );
              })}
            </View>
            {tempBadges.length > 0 ? (
              <Text style={styles.badgeCount}>{tempBadges.length} / 3 selected</Text>
            ) : null}

            <View style={styles.badgeSelectGrid}>
              {earnedBadges.map((slug) => {
                const art = achievementArt(slug);
                const isSelected = tempBadges.includes(slug);
                const isFull = tempBadges.length >= 3 && !isSelected;
                return (
                  <TouchableOpacity
                    key={slug}
                    accessibilityRole="button"
                    style={[
                      styles.badgeSelectCell,
                      isSelected && styles.badgeSelectCellActive,
                      isFull && styles.badgeSelectCellDisabled,
                    ]}
                    disabled={isFull}
                    onPress={withTapCue(() => toggleBadge(slug))}
                  >
                    {art ? (
                      <Image source={art} style={styles.badgeSelectImage} contentFit="contain" />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              {earnedBadges.length === 0 ? (
                <Text style={styles.badgeEmptyText}>No badges earned yet.</Text>
              ) : null}
            </View>

            {error ? <Text style={styles.errorLine}>{error}</Text> : null}

            <View style={styles.sheetActions}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.cancelButton}
                disabled={saving}
                onPress={withTapCue(closeBadges)}
              >
                <Text style={styles.cancelLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                disabled={saving}
                onPress={withTapCue(() => void saveBadges())}
              >
                <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  cardHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  loadoutList: {
    gap: spacing.md,
  },
  loadoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing.md,
  },
  loadoutSlot: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
  },
  loadoutName: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 22,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  optionLabel: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  optionLocked: {
    color: colors.textMuted,
  },
  optionMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  lockEmblem: {
    width: 20,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fonts.display.family,
    fontSize: 18,
  },
  optionThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
  },
  optionThumbSelected: {
    borderWidth: 2,
    borderColor: colors.reward,
  },
  errorLine: {
    color: colors.danger,
    fontFamily: fonts.body.family,
    fontSize: 13,
    textAlign: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
  },
  cancelLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  saveButton: {
    flex: 2,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.reward,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveLabel: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  badgeHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  badgePreviewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  badgePreviewSlot: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgePreviewActive: {
    borderColor: colors.reward,
  },
  badgePreviewImage: {
    width: 44,
    height: 44,
  },
  badgeCount: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
    textAlign: 'center',
  },
  badgeSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'center',
  },
  badgeSelectCell: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeSelectCellActive: {
    borderColor: colors.reward,
  },
  badgeSelectCellDisabled: {
    opacity: 0.35,
  },
  badgeSelectImage: {
    width: 40,
    height: 40,
  },
  badgeEmptyText: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    width: '100%',
  },
});

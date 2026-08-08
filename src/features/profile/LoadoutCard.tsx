import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { CosmeticRow } from '@/data/repositories/cosmetics';
import { catalogBySlot, DEFAULT_SLOT_SLUGS, type CosmeticSlot } from '@/domain/cosmetics/loadout';
import { pickerRowStrings } from '@/features/profile/format';
import { colors, fonts, radius, spacing } from '@/lib/theme';

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  frame: 'Frame',
  title: 'Title',
  background: 'Background',
  portrait: 'Portrait',
};

export interface LoadoutCardProps {
  catalog: readonly CosmeticRow[];
  owned: ReadonlySet<string>;
  equipped: {
    frame: string | null;
    title: string | null;
    background: string | null;
    portrait: string | null;
  };
  /**
   * Applies an equip (itemId null re-equips the default). The parent owns the
   * optimistic update + revert-on-error; resolves to the error message (or
   * null on success).
   */
  onEquip: (slot: CosmeticSlot, itemId: string | null) => Promise<string | null>;
}

function slotValue(
  equipped: LoadoutCardProps['equipped'],
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
  return items.find((item) => item.id === id)?.name ?? 'Default';
}

/**
 * S8-02 — FR-COS-1/2 loadout picker. Tapping a slot opens the sheet: Owned
 * rows are selectable, unowned rows render as "?" (no rule text — the
 * ownership verdict is server-side); "Default" unequips. Save persists via the
 * parent's optimistic equip; the parent reverts on failure.
 */
export function LoadoutCard({ catalog, owned, equipped, onEquip }: LoadoutCardProps) {
  const [openSlot, setOpenSlot] = useState<CosmeticSlot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Loadout</Text>
        <Text style={styles.cardHint}>Tap a slot to change it</Text>
      </View>
      <View style={styles.loadoutList}>
        {Object.keys(SLOT_LABELS).map((slotName) => {
          const slot = slotName as CosmeticSlot;
          return (
            <TouchableOpacity
              key={slot}
              accessibilityRole="button"
              style={styles.loadoutRow}
              onPress={() => open(slot)}
            >
              <Text style={styles.loadoutSlot}>{SLOT_LABELS[slot]}</Text>
              <Text style={styles.loadoutName}>{slotValue(equipped, slot, catalog)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={openSlot !== null} transparent animationType="slide" onRequestClose={close}>
        {openSlot !== null ? (
          <View style={styles.sheetBackdrop}>
            <Pressable style={styles.sheetDismissArea} onPress={close} />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{SLOT_LABELS[openSlot]}</Text>

              <TouchableOpacity
                accessibilityRole="button"
                style={styles.optionRow}
                disabled={saving}
                onPress={() => setSelected(null)}
              >
                <Ionicons
                  name={selected === null ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={selected === null ? colors.reward : colors.textMuted}
                />
                <Text style={styles.optionLabel}>Default</Text>
                <Text style={styles.optionMeta}>Always available</Text>
              </TouchableOpacity>

              {bySlot[openSlot].map((item) => {
                const strings = pickerRowStrings(item);
                const locked = !item.owned;
                return (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="button"
                    disabled={locked || saving}
                    style={styles.optionRow}
                    onPress={() => setSelected(item.id)}
                  >
                    {locked ? (
                      <Text style={styles.lockEmblem}>{strings[0]}</Text>
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
                    {locked ? (
                      <Text style={styles.optionMeta}>Locked — keep going to earn it</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              {error ? <Text style={styles.errorLine}>{error}</Text> : null}

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.cancelButton}
                  disabled={saving}
                  onPress={close}
                >
                  <Text style={styles.cancelLabel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  disabled={saving}
                  onPress={() => void save()}
                >
                  <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
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
});

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppTextField } from '@/components/ui/AppTextField';
import { Screen } from '@/components/ui/Screen';
import { track } from '@/data/analytics';
import {
  fetchCustomWorkout,
  fetchExerciseCatalog,
  saveCustomWorkout,
  type CatalogExercise,
} from '@/data/repositories/customWorkouts';
import {
  DEFAULT_WORKOUT_NAME,
  MAX_SEGMENTS,
  MAX_TOTAL_SEC,
  MIN_TOTAL_SEC,
  METER_SCALE_XP,
  NAME_MAX_CHARS,
  REST_DURATION_PRESETS,
  SEGMENT_DURATION_PRESETS,
  ZONE_MARKS,
  isOverflow,
  meterFill,
  projectedXp,
  totalDurationSec,
  validateDraft,
  zoneForXp,
  type CustomSegment,
  type GuardrailViolation,
  type MeterZone,
} from '@/domain/customWorkout/model';
import {
  DIFFICULTY_ART_KEY,
  difficultyLabel,
  type ExerciseDifficulty,
} from '@/domain/exercises/difficulty';
import { difficultyArt, exerciseArt, REST_DETAILED_ART } from '@/features/assets/assetMap';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { withTapCue } from '@/lib/sounds';

const ZONE_COLORS: Record<MeterZone, string> = {
  easy: colors.calm,
  normal: colors.reward,
  hard: colors.rewardStrong,
};

const ZONE_LABELS: Record<MeterZone, string> = {
  easy: 'EASY',
  normal: 'NORMAL',
  hard: 'HARD',
};

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * BYQ-03 — the custom-workout builder (Ref 12 UI spec): name, catalog picker,
 * reorderable build list with duration chips, live XP meter with tier zones,
 * guardrail hints, and Start/Save CTAs. Edit mode arrives as /build?id=…
 */
export default function BuilderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editIdParam = typeof params.id === 'string' ? params.id : null;

  const [catalog, setCatalog] = useState<CatalogExercise[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [segments, setSegments] = useState<CustomSegment[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const result = await fetchExerciseCatalog();
    if (result.error || !result.data) {
      setStatus('error');
      return;
    }
    setCatalog(result.data);
    if (editIdParam && editIdParam !== loadedEditId) {
      const existing = await fetchCustomWorkout(editIdParam);
      if (existing.data) {
        setEditingId(existing.data.id);
        setLoadedEditId(existing.data.id);
        setName(existing.data.name === DEFAULT_WORKOUT_NAME ? '' : existing.data.name);
        setSegments(existing.data.segments);
      }
    }
    setStatus('ready');
  }, [editIdParam, loadedEditId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const difficultyOf = useCallback(
    (slug: string) => catalog?.find((exercise) => exercise.slug === slug)?.difficulty ?? null,
    [catalog],
  );
  const nameOf = useCallback(
    (slug: string) => catalog?.find((exercise) => exercise.slug === slug)?.name ?? slug,
    [catalog],
  );

  const xp = projectedXp(segments, difficultyOf);
  const totalSec = totalDurationSec(segments);
  const violations = validateDraft(segments);
  const valid = violations.length === 0;
  const overflow = isOverflow(xp);

  const addSegment = (slug: string) => {
    if (segments.length >= MAX_SEGMENTS) {
      return;
    }
    setSegments((current) => [
      ...current,
      { kind: 'exercise' as const, exerciseSlug: slug, durationSec: 45 },
    ]);
    void track('custom_segment_added', {});
  };

  // WK ruling — rest blocks: 0 points, but they fill time and the block cap.
  const addRest = () => {
    if (segments.length >= MAX_SEGMENTS) {
      return;
    }
    setSegments((current) => [...current, { kind: 'rest' as const, durationSec: 30 }]);
    void track('custom_segment_added', { kind: 'rest' });
  };

  const removeAt = (index: number) => {
    setSegments((current) => current.filter((_, i) => i !== index));
    void track('custom_segment_removed', {});
  };

  const setDuration = (index: number, durationSec: number) => {
    setSegments((current) =>
      current.map((segment, i) => (i === index ? { ...segment, durationSec } : segment)),
    );
  };

  const move = (index: number, delta: -1 | 1) => {
    setSegments((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      const row = next[index];
      next[index] = next[target]!;
      next[target] = row!;
      return next;
    });
  };

  const persist = async (): Promise<string | null> => {
    if (!valid || saving) {
      return null;
    }
    setSaving(true);
    setToast(null);
    const result = await saveCustomWorkout({
      id: editingId ?? undefined,
      name,
      segments,
    });
    setSaving(false);
    if (result.error || !result.data) {
      setToast('Could not save — check your connection and try again.');
      return null;
    }
    void track('custom_workout_saved', { segments: segments.length });
    return result.data;
  };

  const onSave = async () => {
    const id = await persist();
    if (id !== null) {
      if (editingId === null) {
        setEditingId(id);
      }
      setToast('Saved.');
    }
  };

  const onStartQuest = async () => {
    const id = await persist();
    if (id === null) {
      return;
    }
    void track('custom_quest_started', { segments: segments.length });
    router.replace({
      pathname: '/workout/[id]',
      params: { id, title: name.trim() || DEFAULT_WORKOUT_NAME, source: 'custom' },
    });
  };

  const hint = guardrailHint(violations, totalSec);

  return (
    <Screen>
      <View style={styles.screen}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={withTapCue(() => router.back())}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backLabel}>{editingId ? 'Edit Quest' : 'Build Your Quest'}</Text>
        </TouchableOpacity>

        {status === 'loading' ? (
          <View style={styles.center}>
            <Text style={styles.quietLine}>Loading exercises…</Text>
          </View>
        ) : status === 'error' || !catalog ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>The exercise shelf is empty.</Text>
            <Text style={styles.quietLine}>Could not load exercises. Try again in a moment.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={withTapCue(() => {
                setStatus('loading');
                void load();
              })}
            >
              <Text style={styles.retryLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Spec item 1 — name (optional, ≤60, defaults to Custom Quest). */}
              <AppTextField
                label="Name (optional)"
                value={name}
                onChangeText={(text) => setName(text.slice(0, NAME_MAX_CHARS))}
                placeholder={`Leave blank for “${DEFAULT_WORKOUT_NAME}”`}
                maxLength={NAME_MAX_CHARS}
              />

              {/* Spec item 3 — the build list. */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Quest</Text>
                {segments.length === 0 ? (
                  <Text style={styles.quietLine}>
                    Nothing here yet — tap exercises below to forge your quest.
                  </Text>
                ) : (
                  segments.map((segment, index) => (
                    <BuildRow
                      key={`${segment.kind}-${segment.kind === 'rest' ? 'rest' : segment.exerciseSlug}-${index}`}
                      index={index}
                      count={segments.length}
                      segment={segment}
                      name={segment.kind === 'rest' ? 'Rest' : nameOf(segment.exerciseSlug)}
                      difficulty={
                        segment.kind === 'exercise' ? difficultyOf(segment.exerciseSlug) : null
                      }
                      onDuration={(durationSec) => setDuration(index, durationSec)}
                      onMove={(delta) => move(index, delta)}
                      onRemove={() => removeAt(index)}
                    />
                  ))
                )}
                <Text style={styles.totalsLine}>
                  {mmss(totalSec)} · {segments.length} block{segments.length === 1 ? '' : 's'}
                  {hint && !violations.includes('empty') ? `  ·  ${hint}` : ''}
                </Text>
              </View>

              {/* Spec item 2 — catalog picker. */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Exercises</Text>
                <Text style={styles.quietLine}>
                  Tap to add — duplicates are allowed, order is up to you.
                </Text>
                <View style={styles.pickerWrap}>
                  {catalog.map((exercise) => {
                    const full = segments.length >= MAX_SEGMENTS;
                    const icon = difficultyArt(DIFFICULTY_ART_KEY[exercise.difficulty]);
                    return (
                      <TouchableOpacity
                        key={exercise.slug}
                        accessibilityRole="button"
                        style={[styles.pickChip, full ? styles.pickChipDisabled : null]}
                        disabled={full}
                        onPress={withTapCue(() => addSegment(exercise.slug))}
                      >
                        {exerciseArt(exercise.slug) !== null ? (
                          <Image
                            source={exerciseArt(exercise.slug)}
                            style={styles.pickThumb}
                            contentFit="contain"
                          />
                        ) : null}
                        <Text style={styles.pickName} numberOfLines={1}>
                          {exercise.name}
                        </Text>
                        {icon !== null ? (
                          <Image
                            source={icon}
                            style={styles.pickIcon}
                            contentFit="contain"
                            accessibilityLabel={`${difficultyLabel(exercise.difficulty)} difficulty`}
                          />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Rest blocks — 0 XP on the meter, but they fill time and
                count toward the 12-block cap (WK ruling). */}
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[
                    styles.restChip,
                    segments.length >= MAX_SEGMENTS ? styles.pickChipDisabled : null,
                  ]}
                  disabled={segments.length >= MAX_SEGMENTS}
                  onPress={withTapCue(addRest)}
                >
                  <Image
                    source={REST_DETAILED_ART}
                    style={styles.restChipIcon}
                    contentFit="contain"
                    accessibilityLabel="Rest"
                  />
                  <Text style={styles.pickName}>Rest</Text>
                  <Text style={styles.restChipHint}>30s · no XP</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Spec items 4–6 — sticky meter, hints, CTAs. */}
            <View style={styles.footer}>
              <XpMeter xp={xp} overflow={overflow} />
              <View style={styles.ctaRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.startButton, valid ? null : styles.buttonDisabled]}
                  disabled={!valid || saving}
                  onPress={withTapCue(() => void onStartQuest())}
                >
                  <Text style={styles.startLabel}>{saving ? 'Saving…' : 'Start Quest'}</Text>
                  <Ionicons name="play" size={18} color={colors.background} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.saveButton, valid ? null : styles.buttonDisabled]}
                  disabled={!valid || saving}
                  onPress={withTapCue(() => void onSave())}
                >
                  <Text style={styles.saveLabel}>Save</Text>
                </TouchableOpacity>
              </View>
              {hint !== null ? <Text style={styles.ctaHint}>{hint}</Text> : null}
              {toast !== null ? <Text style={styles.toast}>{toast}</Text> : null}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function guardrailHint(violations: GuardrailViolation[], totalSec: number): string | null {
  if (violations.includes('segment_cap')) {
    return `Up to ${MAX_SEGMENTS} exercises.`;
  }
  if (violations.includes('max_total')) {
    return `Keep it under ${MAX_TOTAL_SEC / 60} min total.`;
  }
  if (violations.includes('min_total')) {
    const missing = MIN_TOTAL_SEC - totalSec;
    const blocks = Math.ceil(missing / SEGMENT_DURATION_PRESETS[0]);
    return `Add ${blocks} more short block${blocks > 1 ? 's' : ''} — at least ${MIN_TOTAL_SEC / 60} min total.`;
  }
  if (violations.includes('empty')) {
    return 'Pick exercises below to start building.';
  }
  return null;
}

function BuildRow({
  index,
  count,
  segment,
  name,
  difficulty,
  onDuration,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  segment: CustomSegment;
  name: string;
  difficulty: ExerciseDifficulty | null;
  onDuration: (durationSec: number) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isRest = segment.kind === 'rest';
  const thumb = isRest ? null : exerciseArt(segment.exerciseSlug);
  const diffIcon =
    !isRest && difficulty !== null ? difficultyArt(DIFFICULTY_ART_KEY[difficulty]) : null;
  const presets = isRest ? REST_DURATION_PRESETS : SEGMENT_DURATION_PRESETS;
  return (
    <View style={[styles.rowCard, isRest ? styles.rowCardRest : null]}>
      <View style={styles.rowMain}>
        {isRest ? (
          <Image source={REST_DETAILED_ART} style={styles.restSimpleIcon} contentFit="contain" />
        ) : thumb !== null ? (
          <Image source={thumb} style={styles.rowThumb} contentFit="contain" />
        ) : null}
        <View style={styles.rowLeft}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.chipRow}>
            {presets.map((preset) => (
              <TouchableOpacity
                key={preset}
                accessibilityRole="button"
                style={[
                  styles.durationChip,
                  segment.durationSec === preset ? styles.durationChipActive : null,
                ]}
                onPress={withTapCue(() => onDuration(preset))}
              >
                <Text
                  style={[
                    styles.durationChipLabel,
                    segment.durationSec === preset ? styles.durationChipLabelActive : null,
                  ]}
                >
                  {preset}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {diffIcon !== null ? (
          <Image
            source={diffIcon}
            style={styles.diffIcon}
            contentFit="contain"
            accessibilityLabel={
              difficulty !== null ? `${difficultyLabel(difficulty)} difficulty` : undefined
            }
          />
        ) : null}
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={index === 0}
          onPress={withTapCue(() => onMove(-1))}
        >
          <Ionicons
            name="arrow-up-circle-outline"
            size={22}
            color={index === 0 ? colors.surfaceElevated : colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={index === count - 1}
          onPress={withTapCue(() => onMove(1))}
        >
          <Ionicons
            name="arrow-down-circle-outline"
            size={22}
            color={index === count - 1 ? colors.surfaceElevated : colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={withTapCue(onRemove)}
        >
          <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * BYQ-03 spec item 4 — code-drawn live meter. Zone marks sit at their natural
 * positions on the calibration scale (270 XP ceiling fills the bar); past the
 * Hard mark the fill turns reward-strong and the track gains an amber ring.
 */
export function XpMeter({ xp, overflow }: { xp: number; overflow: boolean }) {
  const zone = zoneForXp(xp);
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterTitle}>Projected XP</Text>
        <Text style={[styles.meterXp, { color: ZONE_COLORS[zone] }]}>
          {xp} XP · {ZONE_LABELS[zone]}
          {overflow ? '+' : ''}
        </Text>
      </View>
      <View style={[styles.meterTrack, overflow ? styles.meterTrackGlow : null]}>
        <View
          style={[
            styles.meterFill,
            { width: `${Math.round(meterFill(xp) * 100)}%`, backgroundColor: ZONE_COLORS[zone] },
            overflow ? styles.meterFillOverflow : null,
          ]}
        />
        {[ZONE_MARKS.easy, ZONE_MARKS.normal, ZONE_MARKS.hard].map((mark) => (
          <View
            key={mark}
            style={[styles.zoneMark, { left: `${(mark / METER_SCALE_XP) * 100}%` }]}
          />
        ))}
      </View>
      <View style={styles.zoneLabels}>
        {(['easy', 'normal', 'hard'] as const).map((z) => (
          <Text
            key={z}
            style={[styles.zoneLabelText, { left: `${(ZONE_MARKS[z] / METER_SCALE_XP) * 100}%` }]}
          >
            {ZONE_LABELS[z]}
          </Text>
        ))}
      </View>
    </View>
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
    minHeight: 44,
    marginBottom: spacing.md,
  },
  backLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 18,
  },
  quietLine: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
  },
  errorTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 22,
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
  rowCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowCardRest: {
    backgroundColor: colors.surfaceElevated,
  },
  restIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  restSimpleIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
  },
  restChipIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
  },
  restChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.calm,
    borderStyle: 'dashed',
  },
  restChipHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
    marginLeft: 'auto',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  rowLeft: {
    flex: 1,
    gap: spacing.sm,
  },
  rowName: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 30,
    justifyContent: 'center',
  },
  durationChipActive: {
    backgroundColor: colors.reward,
  },
  durationChipLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  durationChipLabelActive: {
    color: colors.background,
  },
  diffIcon: {
    width: 20,
    height: 20,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  totalsLine: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  pickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  pickChipDisabled: {
    opacity: 0.4,
  },
  pickThumb: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  pickName: {
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 14,
    flexShrink: 1,
    maxWidth: 150,
  },
  pickIcon: {
    width: 16,
    height: 16,
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceElevated,
    gap: spacing.md,
  },
  meterWrap: {
    gap: spacing.xs,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  meterTitle: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meterXp: {
    fontFamily: fonts.display.family,
    fontSize: 16,
  },
  meterTrack: {
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  meterTrackGlow: {
    borderColor: colors.rewardStrong,
  },
  meterFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  meterFillOverflow: {
    shadowColor: colors.rewardStrong,
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  zoneMark: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.background,
    opacity: 0.7,
  },
  zoneLabels: {
    height: 14,
    position: 'relative',
  },
  zoneLabelText: {
    position: 'absolute',
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 10,
    transform: [{ translateX: -14 }],
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.reward,
  },
  startLabel: {
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 17,
  },
  saveButton: {
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.reward,
  },
  saveLabel: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  ctaHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  toast: {
    color: colors.success,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { memo, useCallback, useMemo, useState } from 'react';
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
import { DIFFICULTY_ART_KEY, type ExerciseDifficulty } from '@/domain/exercises/difficulty';
import { difficultyArt, exerciseThumb, REST_DETAILED_ART } from '@/features/assets/assetMap';
import { exerciseName } from '@/features/catalog/copy';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { withTapCue } from '@/lib/sounds';

const ZONE_COLORS: Record<MeterZone, string> = {
  easy: colors.calm,
  normal: colors.reward,
  hard: colors.rewardStrong,
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
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editIdParam = typeof params.id === 'string' ? params.id : null;

  const [catalog, setCatalog] = useState<CatalogExercise[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  // Localized fallback quest name (Arabic review: no raw English in the UI).
  // The legacy English constant still blanks correctly for pre-existing rows.
  const defaultName = t('build.defaultName');
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
        setName(
          existing.data.name === DEFAULT_WORKOUT_NAME || existing.data.name === defaultName
            ? ''
            : existing.data.name,
        );
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

  const difficultyMap = useMemo(
    () => new Map(catalog?.map((e) => [e.slug, e.difficulty]) ?? []),
    [catalog],
  );
  const nameMap = useMemo(() => new Map(catalog?.map((e) => [e.slug, e.name]) ?? []), [catalog]);

  const difficultyOf = useCallback(
    (slug: string): ExerciseDifficulty | null => {
      return difficultyMap.get(slug) ?? null;
    },
    [difficultyMap],
  );
  const nameOf = useCallback(
    (slug: string): string => {
      return nameMap.get(slug) ?? slug;
    },
    [nameMap],
  );

  const xp = useMemo(() => projectedXp(segments, difficultyOf), [segments, difficultyOf]);
  const totalSec = useMemo(() => totalDurationSec(segments), [segments]);
  const violations = useMemo(() => validateDraft(segments), [segments]);
  const valid = violations.length === 0;
  const overflow = useMemo(() => isOverflow(xp), [xp]);

  const addSegment = useCallback((slug: string) => {
    setSegments((current) => {
      if (current.length >= MAX_SEGMENTS) return current;
      return [...current, { kind: 'exercise' as const, exerciseSlug: slug, durationSec: 45 }];
    });
    void track('custom_segment_added', {});
  }, []);

  // WK ruling — rest blocks: 0 points, but they fill time and the block cap.
  const addRest = useCallback(() => {
    setSegments((current) => {
      if (current.length >= MAX_SEGMENTS) return current;
      return [...current, { kind: 'rest' as const, durationSec: 30 }];
    });
    void track('custom_segment_added', { kind: 'rest' });
  }, []);

  const persist = async (): Promise<string | null> => {
    if (!valid || saving) {
      return null;
    }
    setSaving(true);
    setToast(null);
    const result = await saveCustomWorkout({
      id: editingId ?? undefined,
      name: name.trim() || defaultName,
      segments,
    });
    setSaving(false);
    if (result.error || !result.data) {
      setToast(t('build.saveFailed'));
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
      setToast(t('build.saved'));
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
      params: { id, title: name.trim() || defaultName, source: 'custom' },
    });
  };

  const handleDuration = useCallback((index: number, durationSec: number) => {
    setSegments((current) =>
      current.map((segment, i) => (i === index ? { ...segment, durationSec } : segment)),
    );
  }, []);

  const handleMove = useCallback((index: number, delta: -1 | 1) => {
    setSegments((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const row = next[index];
      next[index] = next[target]!;
      next[target] = row!;
      return next;
    });
  }, []);

  const handleRemove = useCallback((index: number) => {
    setSegments((current) => current.filter((_, i) => i !== index));
    void track('custom_segment_removed', {});
  }, []);

  const hint = guardrailHint(violations, totalSec, t);

  return (
    <Screen>
      <View style={styles.screen}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.backRow}
          onPress={withTapCue(() => router.back())}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backLabel}>
            {editingId ? t('build.editTitle') : t('build.createTitle')}
          </Text>
        </TouchableOpacity>

        {status === 'loading' ? (
          <View style={styles.center}>
            <Text style={styles.quietLine}>{t('build.loading')}</Text>
          </View>
        ) : status === 'error' || !catalog ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>{t('build.emptyTitle')}</Text>
            <Text style={styles.quietLine}>{t('build.emptyLine')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.retryButton}
              onPress={withTapCue(() => {
                setStatus('loading');
                void load();
              })}
            >
              <Text style={styles.retryLabel}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Spec item 1 — name (optional, ≤60, defaults to the localized quest name). */}
              <AppTextField
                label={t('build.nameLabel')}
                value={name}
                onChangeText={(text) => setName(text.slice(0, NAME_MAX_CHARS))}
                placeholder={t('build.namePlaceholder', { name: defaultName })}
                maxLength={NAME_MAX_CHARS}
              />

              {/* Spec item 3 — the build list. */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('build.yourQuest')}</Text>
                {segments.length === 0 ? (
                  <Text style={styles.quietLine}>{t('build.emptyQuest')}</Text>
                ) : (
                  segments.map((segment, index) => (
                    <BuildRow
                      key={`${segment.kind}-${segment.kind === 'rest' ? 'rest' : segment.exerciseSlug}-${index}`}
                      index={index}
                      isFirst={index === 0}
                      isLast={index === segments.length - 1}
                      segment={segment}
                      name={
                        segment.kind === 'rest'
                          ? t('build.restName')
                          : (exerciseName(segment.exerciseSlug, nameOf(segment.exerciseSlug), t) ??
                            nameOf(segment.exerciseSlug))
                      }
                      difficulty={
                        segment.kind === 'exercise' ? difficultyOf(segment.exerciseSlug) : null
                      }
                      onDuration={handleDuration}
                      onMove={handleMove}
                      onRemove={handleRemove}
                    />
                  ))
                )}
                <Text style={styles.totalsLine}>
                  {t('build.totals', { time: mmss(totalSec), count: segments.length })}
                  {hint && !violations.includes('empty') ? `  ·  ${hint}` : ''}
                </Text>
              </View>

              {/* Spec item 2 — catalog picker. */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('build.exercisesTitle')}</Text>
                <Text style={styles.quietLine}>{t('build.exercisesHint')}</Text>
                <View style={styles.pickerWrap}>
                  {catalog.map((exercise) => (
                    <CatalogChip
                      key={exercise.slug}
                      exercise={exercise}
                      disabled={segments.length >= MAX_SEGMENTS}
                      onAdd={addSegment}
                    />
                  ))}
                </View>
                {/* Rest blocks — 0 XP on the meter, but they fill time and
                count toward the 16-block cap (WK ruling). */}
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
                    accessibilityLabel={t('build.restName')}
                  />
                  <Text style={styles.pickName}>{t('build.restName')}</Text>
                  <Text style={styles.restChipHint}>{t('build.restMeta')}</Text>
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
                  <Text style={styles.startLabel}>
                    {saving ? t('build.saving') : t('build.start')}
                  </Text>
                  <Ionicons name="play" size={18} color={colors.background} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.saveButton, valid ? null : styles.buttonDisabled]}
                  disabled={!valid || saving}
                  onPress={withTapCue(() => void onSave())}
                >
                  <Text style={styles.saveLabel}>{t('common.save')}</Text>
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

function guardrailHint(
  violations: GuardrailViolation[],
  totalSec: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (violations.includes('segment_cap')) {
    return t('build.maxBlocks', { max: MAX_SEGMENTS });
  }
  if (violations.includes('max_total')) {
    return t('build.maxTime', { n: MAX_TOTAL_SEC / 60 });
  }
  if (violations.includes('min_total')) {
    const missing = MIN_TOTAL_SEC - totalSec;
    const blocks = Math.ceil(missing / SEGMENT_DURATION_PRESETS[0]);
    return t('build.needMore', { n: blocks, min: MIN_TOTAL_SEC / 60 });
  }
  if (violations.includes('empty')) {
    return t('build.pickToStart');
  }
  return null;
}

const CatalogChip = memo(function CatalogChip({
  exercise,
  disabled,
  onAdd,
}: {
  exercise: CatalogExercise;
  disabled: boolean;
  onAdd: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const icon = difficultyArt(DIFFICULTY_ART_KEY[exercise.difficulty]);
  const thumb = exerciseThumb(exercise.slug);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.pickChip, disabled ? styles.pickChipDisabled : null]}
      disabled={disabled}
      onPress={withTapCue(() => onAdd(exercise.slug))}
    >
      {thumb !== null ? (
        <Image source={thumb} style={styles.pickThumb} contentFit="contain" />
      ) : null}
      <Text style={styles.pickName} numberOfLines={1}>
        {exerciseName(exercise.slug, exercise.name, t) ?? exercise.name}
      </Text>
      {icon !== null ? (
        <Image
          source={icon}
          style={styles.pickIcon}
          contentFit="contain"
          accessibilityLabel={t('quest.difficultyA11y', {
            level: t(`quest.difficultyName.${exercise.difficulty}`),
          })}
        />
      ) : null}
    </TouchableOpacity>
  );
});

const BuildRow = memo(function BuildRow({
  index,
  isFirst,
  isLast,
  segment,
  name,
  difficulty,
  onDuration,
  onMove,
  onRemove,
}: {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  segment: CustomSegment;
  name: string;
  difficulty: ExerciseDifficulty | null;
  onDuration: (index: number, durationSec: number) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const isRest = segment.kind === 'rest';
  const thumb = isRest ? null : exerciseThumb(segment.exerciseSlug);
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
            {isRest ? name : (exerciseName(segment.exerciseSlug, name, t) ?? name)}
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
                onPress={withTapCue(() => onDuration(index, preset))}
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
              difficulty !== null
                ? t('quest.difficultyA11y', { level: t(`quest.difficultyName.${difficulty}`) })
                : undefined
            }
          />
        ) : null}
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isFirst}
          onPress={withTapCue(() => onMove(index, -1))}
        >
          <Ionicons
            name="arrow-up-circle-outline"
            size={22}
            color={isFirst ? colors.surfaceElevated : colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isLast}
          onPress={withTapCue(() => onMove(index, 1))}
        >
          <Ionicons
            name="arrow-down-circle-outline"
            size={22}
            color={isLast ? colors.surfaceElevated : colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={withTapCue(() => onRemove(index))}
        >
          <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
});
/**
 * BYQ-03 spec item 4 — code-drawn live meter. Zone marks sit at their natural
 * positions on the calibration scale (270 XP ceiling fills the bar); past the
 * Hard mark the fill turns reward-strong and the track gains an amber ring.
 */
export const XpMeter = memo(function XpMeter({ xp, overflow }: { xp: number; overflow: boolean }) {
  const { t } = useTranslation();
  const zone = zoneForXp(xp);
  const zoneLabels: Record<MeterZone, string> = {
    easy: t('build.zoneEasy'),
    normal: t('build.zoneNormal'),
    hard: t('build.zoneHard'),
  };
  return (
    <View style={styles.meterWrap}>
      <View style={styles.meterHeader}>
        <Text style={styles.meterTitle}>{t('build.projectedXp')}</Text>
        <Text style={[styles.meterXp, { color: ZONE_COLORS[zone] }]}>
          {xp} XP · {zoneLabels[zone]}
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
            style={[styles.zoneMark, { start: `${(mark / METER_SCALE_XP) * 100}%` }]}
          />
        ))}
      </View>
      <View style={styles.zoneLabels}>
        {(['easy', 'normal', 'hard'] as const).map((z) =>
          z === 'hard' ? (
            <Text key={z} style={[styles.zoneLabelText, styles.zoneLabelEnd]}>
              {zoneLabels[z]}
            </Text>
          ) : (
            <Text
              key={z}
              style={[
                styles.zoneLabelText,
                { start: `${(ZONE_MARKS[z] / METER_SCALE_XP) * 100}%` },
              ]}
            >
              {zoneLabels[z]}
            </Text>
          ),
        )}
      </View>
    </View>
  );
});

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
    marginStart: 'auto',
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
    paddingStart: spacing.xs,
    paddingEnd: spacing.md,
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
  // I18N-03 — the hard zone ends at 100% of the track, so a start-anchored
  // label always overflows (worse in RTL). Pin it to the inline end instead.
  zoneLabelEnd: {
    end: 0,
    transform: [{ translateX: 0 }],
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

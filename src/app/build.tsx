import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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

type BuildFilter = 'all' | 'strength' | 'endurance' | 'mobility' | 'rest';

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * BYQ-03 Fantasy RPG overhaul — the custom-workout Quest Forge: crest header,
 * parchment quest-name card, YOUR QUEST sequence panel with tap-to-move
 * reorder, ADD EXERCISE search + track filters + 2-column grid, stepped XP
 * meter, and the golden Start/Save action bar. All math, validation, RPCs,
 * discard guards, and i18n keys ride the original logic untouched.
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
  const [discardVisible, setDiscardVisible] = useState(false);
  // Forge UI state: live catalog search, track filter tabs, and the
  // tap-to-move reorder cursor (tap ≡ on one row, then ≡ on the target row).
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BuildFilter>('all');
  const [moveFrom, setMoveFrom] = useState<number | null>(null);
  // Last-saved snapshot for the discard guard: fresh drafts start clean,
  // edit loads and successful saves re-baseline. Compared as JSON.
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({ name: '', segments: [] as CustomSegment[] }),
  );

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
        const initialName =
          existing.data.name === DEFAULT_WORKOUT_NAME || existing.data.name === defaultName
            ? ''
            : existing.data.name;
        setName(initialName);
        setSegments(existing.data.segments);
        setSavedSnapshot(
          JSON.stringify({ name: initialName.trim(), segments: existing.data.segments }),
        );
      }
    }
    setStatus('ready');
  }, [defaultName, editIdParam, loadedEditId]);

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
  const estimatedMinutes = Math.max(1, Math.round(totalSec / 60));

  // Catalog search + track filters (server-owned categories; Rest is the
  // synthetic breather card, not a catalog row).
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCatalog = useMemo(() => {
    if (!catalog) return [];
    return catalog.filter((exercise) => {
      if (filter === 'rest') return false;
      if (filter !== 'all' && !exercise.categories.includes(filter)) return false;
      if (!normalizedQuery) return true;
      const localized = exerciseName(exercise.slug, exercise.name, t) ?? exercise.name;
      return (
        localized.toLowerCase().includes(normalizedQuery) ||
        exercise.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [catalog, filter, normalizedQuery, t]);
  const restVisible = useMemo(() => {
    if (filter !== 'all' && filter !== 'rest') return false;
    if (!normalizedQuery) return true;
    return (
      t('build.restName').toLowerCase().includes(normalizedQuery) ||
      t('build.breatherName').toLowerCase().includes(normalizedQuery) ||
      'rest'.includes(normalizedQuery)
    );
  }, [filter, normalizedQuery, t]);

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
    setSavedSnapshot(JSON.stringify({ name: name.trim(), segments }));
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

  // Discard guard: leaving with unsaved changes asks first (both the header
  // Back button and Android hardware back). Clean drafts leave instantly.
  const dirty = useMemo(
    () => JSON.stringify({ name: name.trim(), segments }) !== savedSnapshot,
    [name, segments, savedSnapshot],
  );
  const onBack = useCallback(() => {
    if (dirty && !saving) {
      setDiscardVisible(true);
    } else {
      router.back();
    }
  }, [dirty, saving, router, setDiscardVisible]);
  const onSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (discardVisible) {
        return false;
      }
      if (dirty && !saving) {
        setDiscardVisible(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [dirty, saving, discardVisible]);

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

  const handleMoveTo = useCallback((from: number, to: number) => {
    setSegments((current) => {
      if (from < 0 || from >= current.length || to < 0 || to >= current.length || from === to) {
        return current;
      }
      const next = [...current];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row!);
      return next;
    });
  }, []);

  // Tap-to-move reorder: tap ≡ to arm a row, tap another row's ≡ to drop it
  // there. Single-step nudges stay on the chevrons next to each row.
  const onHandlePress = useCallback(
    (index: number) => {
      if (moveFrom === null) {
        setMoveFrom(index);
        return;
      }
      if (moveFrom === index) {
        setMoveFrom(null);
        return;
      }
      handleMoveTo(moveFrom, index);
      setMoveFrom(null);
    },
    [moveFrom, handleMoveTo],
  );

  const handleRemove = useCallback((index: number) => {
    setSegments((current) => current.filter((_, i) => i !== index));
    setMoveFrom((current) =>
      current === null
        ? current
        : current === index
          ? null
          : current > index
            ? current - 1
            : current,
    );
    void track('custom_segment_removed', {});
  }, []);

  const hint = guardrailHint(violations, totalSec, t);

  return (
    <Screen>
      <View style={styles.screen}>
        {/* Forge header: shield back (discard-guarded), crown crest + title, gear. */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('build.editTitle')}
            style={styles.shieldButton}
            onPress={withTapCue(() => onBack())}
          >
            <Ionicons name="chevron-back" size={22} color={colors.reward} />
            <Ionicons
              name="chevron-back"
              size={22}
              color={colors.reward}
              style={styles.shieldChevOverlap}
            />
          </TouchableOpacity>
          <View style={styles.crestWrap}>
            <Ionicons name="shield" size={30} color={colors.reward} />
            <Text style={styles.headerTitle}>
              {editingId ? t('build.editTitle') : t('build.createTitle')}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.shieldButton}
            onPress={withTapCue(() => onSettings())}
          >
            <Ionicons name="settings-outline" size={20} color={colors.reward} />
          </TouchableOpacity>
        </View>

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
              {/* Quest name — framed parchment card, optional ≤60 chars. */}
              <View style={styles.nameCard}>
                <View style={styles.nameLabelRow}>
                  <Ionicons name="receipt" size={18} color={colors.reward} />
                  <Text style={styles.nameLabel}>{t('build.questName')}</Text>
                </View>
                <TextInput
                  value={name}
                  onChangeText={(text) => setName(text.slice(0, NAME_MAX_CHARS))}
                  placeholder={t('build.questNamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={NAME_MAX_CHARS}
                  style={styles.nameInput}
                />
              </View>

              {/* YOUR QUEST — the selected sequence with tap-to-move reorder. */}
              <View style={styles.questPanel}>
                <View style={styles.bannerFlag} />
                <Text style={styles.panelTitle}>{t('build.yourQuest')}</Text>
                <Text style={styles.panelSub}>
                  {t('build.totals', { time: mmss(totalSec), count: segments.length })}
                </Text>
                {segments.length === 0 ? (
                  <View style={styles.emptyQuestWrap}>
                    <Ionicons
                      name="shield-outline"
                      size={72}
                      color={colors.surfaceElevated}
                      style={styles.emptyWatermark}
                    />
                    <Text style={styles.emptyQuestText}>{t('build.emptyQuest')}</Text>
                  </View>
                ) : (
                  segments.map((segment, index) => (
                    <BuildRow
                      key={`${segment.kind}-${segment.kind === 'rest' ? 'rest' : segment.exerciseSlug}-${index}`}
                      index={index}
                      order={index + 1}
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
                      armed={moveFrom === index}
                      arming={moveFrom !== null && moveFrom !== index}
                      onHandlePress={onHandlePress}
                      onDuration={handleDuration}
                      onMove={handleMove}
                      onRemove={handleRemove}
                    />
                  ))
                )}
                {hint && !violations.includes('empty') ? (
                  <Text style={styles.totalsHint}>{hint}</Text>
                ) : null}
              </View>

              {/* ADD EXERCISE — live search, track filters, 2-column grid. */}
              <View style={styles.catalogSection}>
                <View style={styles.addHeaderRow}>
                  <View style={styles.addIconCircle}>
                    <Ionicons name="add" size={20} color={colors.background} />
                  </View>
                  <Text style={styles.panelTitle}>{t('build.addExercise')}</Text>
                </View>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color={colors.textMuted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('build.searchPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                  />
                  {query.length > 0 ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={withTapCue(() => setQuery(''))}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.filterRow}>
                  <FilterPill
                    active={filter === 'all'}
                    label={t('build.filterAll')}
                    icon="apps"
                    onPress={() => setFilter('all')}
                  />
                  <FilterPill
                    active={filter === 'strength'}
                    label={t('build.filterStrength')}
                    icon="barbell"
                    onPress={() => setFilter('strength')}
                  />
                  <FilterPill
                    active={filter === 'endurance'}
                    label={t('build.filterEndurance')}
                    icon="flame"
                    onPress={() => setFilter('endurance')}
                  />
                  <FilterPill
                    active={filter === 'mobility'}
                    label={t('build.filterMobility')}
                    icon="body"
                    onPress={() => setFilter('mobility')}
                  />
                  <FilterPill
                    active={filter === 'rest'}
                    label={t('build.filterRest')}
                    image={REST_DETAILED_ART}
                    onPress={() => setFilter('rest')}
                  />
                </View>
                {filteredCatalog.length === 0 && !restVisible ? (
                  <Text style={styles.quietLine}>{t('build.emptyQuest')}</Text>
                ) : (
                  <View style={styles.gridWrap}>
                    {filteredCatalog.map((exercise) => (
                      <ExerciseGridCard
                        key={exercise.slug}
                        exercise={exercise}
                        disabled={segments.length >= MAX_SEGMENTS}
                        onAdd={addSegment}
                      />
                    ))}
                    {/* Breather — fixed 30s rest block (WK ruling: 0 XP). */}
                    {restVisible ? (
                      <View style={[styles.gridCard, styles.breatherCard]}>
                        <Image
                          source={REST_DETAILED_ART}
                          style={styles.gridThumb}
                          contentFit="cover"
                          accessibilityLabel={t('build.breatherName')}
                        />
                        <View style={styles.gridBody}>
                          <Text style={styles.gridName} numberOfLines={2}>
                            {t('build.breatherName')}
                          </Text>
                          <Text style={styles.gridMeta}>{t('build.restMeta')}</Text>
                        </View>
                        <TouchableOpacity
                          accessibilityRole="button"
                          style={[
                            styles.gridAdd,
                            segments.length >= MAX_SEGMENTS ? styles.pickChipDisabled : null,
                          ]}
                          disabled={segments.length >= MAX_SEGMENTS}
                          onPress={withTapCue(addRest)}
                        >
                          <Ionicons name="add" size={20} color={colors.background} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>

              {/* Projected reward — stepped Easy/Normal/Hard meter. */}
              <XpMeter xp={xp} overflow={overflow} estimatedMinutes={estimatedMinutes} />
            </ScrollView>

            {/* Golden action bar — Start dominates, Save keeps the recipe. */}
            <View style={styles.footer}>
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
                  <Ionicons name="save-outline" size={16} color={colors.reward} />
                  <Text style={styles.saveLabel}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
              {hint !== null ? <Text style={styles.ctaHint}>{hint}</Text> : null}
              {toast !== null ? <Text style={styles.toast}>{toast}</Text> : null}
            </View>
          </>
        )}
      </View>

      <Modal
        visible={discardVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscardVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>{t('build.discardTitle')}</Text>
            <Text style={styles.sheetBody}>{t('build.discardBody')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.sheetDelete}
              onPress={withTapCue(() => {
                setDiscardVisible(false);
                router.back();
              })}
            >
              <Text style={styles.sheetDeleteLabel}>{t('build.discardConfirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.sheetCancel}
              onPress={withTapCue(() => setDiscardVisible(false))}
            >
              <Text style={styles.sheetCancelLabel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    return t('build.needMore', { count: blocks, min: MIN_TOTAL_SEC / 60 });
  }
  if (violations.includes('empty')) {
    return t('build.pickToStart');
  }
  return null;
}

const FilterPill = memo(function FilterPill({
  active,
  label,
  icon,
  image,
  onPress,
}: {
  active: boolean;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  image?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.filterPill, active ? styles.filterPillActive : null]}
      onPress={withTapCue(onPress)}
    >
      {image !== undefined ? (
        <Image source={image} style={styles.filterPillImage} contentFit="contain" />
      ) : icon !== undefined ? (
        <Ionicons name={icon} size={15} color={active ? colors.background : colors.textMuted} />
      ) : null}
      <Text style={[styles.filterPillLabel, active ? styles.filterPillLabelActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

const ExerciseGridCard = memo(function ExerciseGridCard({
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
  const difficultyLabel = t(`quest.difficultyName.${exercise.difficulty}`);
  return (
    <View style={styles.gridCard}>
      {thumb !== null ? (
        <Image
          source={thumb}
          style={styles.gridThumb}
          contentFit="cover"
          accessibilityLabel={exercise.name}
        />
      ) : null}
      <View style={styles.gridBody}>
        <Text style={styles.gridName} numberOfLines={2}>
          {exerciseName(exercise.slug, exercise.name, t) ?? exercise.name}
        </Text>
        <View style={styles.gridMetaRow}>
          <Text style={styles.gridMeta}>45s</Text>
          {icon !== null ? (
            <Image
              source={icon}
              style={styles.gridDiffIcon}
              contentFit="contain"
              accessibilityLabel={t('quest.difficultyA11y', { level: difficultyLabel })}
            />
          ) : null}
          <Text style={styles.gridMeta} numberOfLines={1}>
            {difficultyLabel}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.gridAdd, disabled ? styles.pickChipDisabled : null]}
        disabled={disabled}
        onPress={withTapCue(() => onAdd(exercise.slug))}
      >
        <Ionicons name="add" size={20} color={colors.background} />
      </TouchableOpacity>
    </View>
  );
});

const BuildRow = memo(function BuildRow({
  index,
  order,
  isFirst,
  isLast,
  segment,
  name,
  difficulty,
  armed,
  arming,
  onHandlePress,
  onDuration,
  onMove,
  onRemove,
}: {
  index: number;
  order: number;
  isFirst: boolean;
  isLast: boolean;
  segment: CustomSegment;
  name: string;
  difficulty: ExerciseDifficulty | null;
  armed: boolean;
  arming: boolean;
  onHandlePress: (index: number) => void;
  onDuration: (index: number, durationSec: number) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const isRest = segment.kind === 'rest';
  const thumb = isRest ? REST_DETAILED_ART : exerciseThumb(segment.exerciseSlug);
  const diffIcon =
    !isRest && difficulty !== null ? difficultyArt(DIFFICULTY_ART_KEY[difficulty]) : null;
  const presets = isRest ? REST_DURATION_PRESETS : SEGMENT_DURATION_PRESETS;
  return (
    <View
      style={[
        styles.rowCard,
        isRest ? styles.rowCardRest : null,
        armed ? styles.rowCardArmed : null,
      ]}
    >
      <View style={styles.rowMain}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={name}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={withTapCue(() => onHandlePress(index))}
        >
          <Ionicons
            name="reorder-three"
            size={22}
            color={armed ? colors.reward : arming ? colors.calm : colors.textMuted}
          />
        </TouchableOpacity>
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeLabel}>{order}</Text>
        </View>
        {thumb !== null ? (
          <Image source={thumb} style={styles.rowThumb} contentFit="cover" />
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
                disabled={isRest}
                style={[
                  styles.durationChip,
                  segment.durationSec === preset ? styles.durationChipActive : null,
                  isRest ? styles.durationChipLocked : null,
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
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={withTapCue(() => onRemove(index))}
        >
          <Ionicons name="close" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isFirst}
          onPress={withTapCue(() => onMove(index, -1))}
        >
          <Ionicons
            name="chevron-up"
            size={18}
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
            name="chevron-down"
            size={18}
            color={isLast ? colors.surfaceElevated : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});
/**
 * BYQ-03 spec item 4 — stepped RPG meter. Three segments mirror the quest
 * tiers (Easy 100 / Normal 200 / Hard 400); each fills once the authoritative
 * projected XP reaches its mark. Past the Hard mark the track gains an amber
 * ring via the shared overflow rule.
 */
export const XpMeter = memo(function XpMeter({
  xp,
  overflow,
  estimatedMinutes,
}: {
  xp: number;
  overflow: boolean;
  estimatedMinutes: number;
}) {
  const { t } = useTranslation();
  const zone = zoneForXp(xp);
  const zoneLabels: Record<MeterZone, string> = {
    easy: t('build.zoneEasy'),
    normal: t('build.zoneNormal'),
    hard: t('build.zoneHard'),
  };
  const steps: { key: MeterZone; mark: number }[] = [
    { key: 'easy', mark: ZONE_MARKS.easy },
    { key: 'normal', mark: ZONE_MARKS.normal },
    { key: 'hard', mark: ZONE_MARKS.hard },
  ];
  return (
    <View style={[styles.meterPanel, overflow ? styles.meterPanelGlow : null]}>
      <View style={styles.meterTopRow}>
        <View style={styles.medallion}>
          <Text style={styles.medallionLabel}>XP</Text>
        </View>
        <View style={styles.meterHeadings}>
          <Text style={styles.meterTitle}>{t('build.projectedXp')}</Text>
          <Text style={[styles.meterXp, { color: ZONE_COLORS[zone] }]}>
            {xp} XP · {zoneLabels[zone]}
            {overflow ? '+' : ''}
          </Text>
        </View>
        <View style={styles.estWrap}>
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <Text style={styles.estText}>
            {t('build.estTime')}: ~ {estimatedMinutes} min
          </Text>
        </View>
      </View>
      <View style={styles.stepRow}>
        {steps.map((step) => {
          const filled = xp >= step.mark;
          return (
            <View key={step.key} style={styles.stepWrap}>
              <View style={styles.stepTrack}>
                <View
                  style={[
                    styles.stepFill,
                    filled
                      ? { width: '100%', backgroundColor: ZONE_COLORS[step.key] }
                      : { width: `${Math.round(meterFill(xp) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.stepLabel}>
                {zoneLabels[step.key]} · {step.mark}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const GOLD_BORDER = colors.rewardStrong;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    marginBottom: spacing.md,
  },
  shieldButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: GOLD_BORDER,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldChevOverlap: {
    marginStart: -14,
  },
  crestWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 19,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
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
  nameCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    padding: spacing.md,
    gap: spacing.sm,
  },
  nameLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameLabel: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nameInput: {
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 16,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  questPanel: {
    position: 'relative',
    backgroundColor: 'rgba(22, 26, 34, 0.95)',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    padding: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  bannerFlag: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    width: 6,
    backgroundColor: colors.calmStrong,
  },
  panelTitle: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  panelSub: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  emptyQuestWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyWatermark: {
    opacity: 0.35,
  },
  emptyQuestText: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  totalsHint: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
  },
  rowCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  rowCardRest: {
    backgroundColor: colors.surfaceElevated,
  },
  rowCardArmed: {
    borderColor: colors.reward,
    borderWidth: 2,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeLabel: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
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
  durationChipLocked: {
    borderWidth: 1,
    borderColor: GOLD_BORDER,
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
  catalogSection: {
    gap: spacing.md,
  },
  addHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addIconCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 15,
    minHeight: 44,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },
  filterPillActive: {
    backgroundColor: colors.reward,
    borderColor: colors.reward,
  },
  filterPillImage: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  filterPillLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  filterPillLabelActive: {
    color: colors.background,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  breatherCard: {
    borderColor: colors.calm,
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  gridThumb: {
    width: '100%',
    height: 96,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  gridBody: {
    gap: 4,
    minHeight: 52,
    paddingEnd: 40,
  },
  gridName: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
    lineHeight: 18,
  },
  gridMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gridMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 12,
    flexShrink: 1,
  },
  gridDiffIcon: {
    width: 14,
    height: 14,
  },
  gridAdd: {
    position: 'absolute',
    end: spacing.sm,
    bottom: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickChipDisabled: {
    opacity: 0.4,
  },
  meterPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
    padding: spacing.md,
    gap: spacing.md,
  },
  meterPanelGlow: {
    borderColor: colors.rewardStrong,
  },
  meterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  medallion: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    transform: [{ rotate: '45deg' }],
    backgroundColor: colors.reward,
    borderWidth: 2,
    borderColor: GOLD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionLabel: {
    transform: [{ rotate: '-45deg' }],
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 15,
  },
  meterHeadings: {
    flex: 1,
    gap: 2,
  },
  meterTitle: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meterXp: {
    fontFamily: fonts.display.family,
    fontSize: 16,
  },
  estWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  estText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 11,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepWrap: {
    flex: 1,
    gap: 4,
  },
  stepTrack: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  stepLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 10,
    textAlign: 'center',
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: GOLD_BORDER,
    gap: spacing.md,
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
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.reward,
    borderWidth: 2,
    borderColor: GOLD_BORDER,
  },
  startLabel: {
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 19,
  },
  saveButton: {
    minWidth: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: GOLD_BORDER,
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
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 20,
    textAlign: 'center',
  },
  sheetBody: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  sheetDelete: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  sheetDeleteLabel: {
    color: colors.background,
    fontFamily: fonts.display.family,
    fontSize: 17,
  },
  sheetCancel: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelLabel: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
});

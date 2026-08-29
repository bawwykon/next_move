import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { track } from '@/data/analytics';
import { fetchCustomWorkout, fetchExerciseCatalog } from '@/data/repositories/customWorkouts';
import { fetchQuestDetail, type QuestSegment } from '@/data/repositories/quests';
import {
  buildWorkout,
  countdownMs,
  isComplete,
  nextUp,
  progress,
  remainingMs,
  segmentIndexAt,
  totalRemainingMs,
  type Workout,
  type WorkoutSegmentKind,
} from '@/domain/timer/workoutEngine';
import { REST_DETAILED_ART, exerciseArt } from '@/features/assets/assetMap';
import { formatCountdown, formatTotalRemaining } from '@/features/timer/format';
import { finishQuest } from '@/features/workout/finishQuest';
import { decideOnForeground } from '@/features/workout/decideOnForeground';
import { pausedNow, shiftStartForResume } from '@/features/workout/pause';
import { segmentKindLabel } from '@/features/questDetail/segmentKind';
import { useAppForeground } from '@/hooks/useAppForeground';
import { useNow } from '@/hooks/useNow';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { playCue, withTapCue } from '@/lib/sounds';
import { useWorkoutStore } from '@/state/workoutStore';

// §7.3 — the timer digits are the largest element on screen; the 3-2-1
// overlay out-sizes them so the countdown moment reads first.
const DIGIT_SIZE = 118;
const COUNTDOWN_SIZE = 150;

const KIND_COLORS: Record<WorkoutSegmentKind, string> = {
  warmup: colors.calm,
  work: colors.reward,
  rest: colors.textMuted,
  cooldown: colors.calm,
};

export default function WorkoutScreen() {
  // FR-TIMER-8 — the screen stays awake for the whole quest.
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; title?: string; source?: string }>();
  const questId = params.id;
  // BYQ-04 — source=custom loads the SAVED custom definition (work-only
  // segments, exactly as built) instead of a catalog quest.
  const isCustom = params.source === 'custom';

  // AT-02F — the art band is sized from the real screen so the illustration
  // always occupies ~35% of the viewport height (aspect-fit, never cropped).
  // Width is an explicit point value: expo-image mis-measures '100%' widths
  // inside a centered flex parent, which shrinks the band to its intrinsic
  // size instead of the full content width.
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const heroHeight = Math.round(screenHeight * 0.35);
  const heroWidth = screenWidth - spacing.xl * 2;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [names, setNames] = useState<(string | null)[]>([]);
  const [slugs, setSlugs] = useState<(string | null)[]>([]);
  // WK-01 — how-to + safety copy per segment index, shown on the pause overlay.
  const [instructions, setInstructions] = useState<(string | null)[]>([]);
  const [safetyNotes, setSafetyNotes] = useState<(string | null)[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [quitVisible, setQuitVisible] = useState(false);
  // WK-01 — the pause instant (null = running). Freezing is screen-level:
  // every engine read clamps to this instant until resume shifts the start.
  const [pausedAtMs, setPausedAtMs] = useState<number | null>(null);
  const handledRef = useRef(false);
  const prevIndexRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!questId) {
      setStatus('error');
      return;
    }
    let segments: QuestSegment[];
    if (isCustom) {
      // BYQ-04 — the saved definition IS the workout, in the built order.
      // Rest blocks run as native rest segments (no cues about exercises).
      // A definition deleted mid-run reads as an error and the run cannot
      // start (the completion RPC would reject it anyway).
      const [customResult, catalogResult] = await Promise.all([
        fetchCustomWorkout(questId),
        fetchExerciseCatalog(),
      ]);
      if (customResult.error || !customResult.data) {
        setStatus('error');
        return;
      }
      const bySlug = new Map(
        (catalogResult.data ?? []).map((exercise) => [exercise.slug, exercise]),
      );
      segments = customResult.data.segments.map((segment, index) => ({
        position: index,
        kind: segment.kind === 'rest' ? ('rest' as const) : ('work' as const),
        durationSec: segment.durationSec,
        exerciseName:
          segment.kind === 'exercise' ? (bySlug.get(segment.exerciseSlug)?.name ?? null) : null,
        exerciseSlug: segment.kind === 'exercise' ? segment.exerciseSlug : null,
        instruction:
          segment.kind === 'exercise'
            ? (bySlug.get(segment.exerciseSlug)?.instruction ?? null)
            : null,
        safetyNote:
          segment.kind === 'exercise'
            ? (bySlug.get(segment.exerciseSlug)?.safetyNote ?? null)
            : null,
      }));
    } else {
      const result = await fetchQuestDetail(questId);
      if (result.error || !result.data) {
        setStatus('error');
        return;
      }
      segments = result.data.segments;
    }
    // S4-03 — a resumed run keeps its stored start instant (correct remaining
    // time, FR-TIMER-5); a fresh start begins now. A kill during a pause
    // relaunches frozen at the stored pause instant (WK-01).
    const checkpoint = useWorkoutStore.getState().checkpoint;
    const resumeSame = checkpoint !== null && checkpoint.questId === questId;
    const resumedPausedAt = resumeSame && checkpoint ? (checkpoint.pausedAtEpochMs ?? null) : null;
    const startedAt = resumeSame && checkpoint ? checkpoint.startedAtEpochMs : Date.now();
    if (!resumeSame) {
      // NFR-9 — a fresh (not resumed) run.
      void track('quest_started', { questId });
    }
    // The checkpoint is persisted before the first frame of exercise display,
    // so an app kill at any point leaves a resumable run behind (FR-TIMER-7).
    setNames(segments.map((s) => (s.kind === 'rest' ? null : s.exerciseName)));
    setSlugs(segments.map((s) => s.exerciseSlug));
    setInstructions(segments.map((s) => s.instruction));
    setSafetyNotes(segments.map((s) => s.safetyNote));
    setWorkout(buildWorkout(segments, startedAt));
    setPausedAtMs(resumedPausedAt);
    void useWorkoutStore
      .getState()
      .startWorkout(questId, startedAt, isCustom ? 'custom' : undefined);
    // startWorkout writes a bare checkpoint — re-pin the pause instant so a
    // kill during this relaunched pause still resumes frozen (WK-01).
    if (resumedPausedAt !== null) {
      void useWorkoutStore.getState().pauseWorkout(resumedPausedAt);
    }
    setStatus('ready');
  }, [questId, isCustom]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Ref 03 rule 6 — the single shared render clock drives every engine read.
  // WK-01 — while paused every read clamps to the pause instant: digits,
  // cues, progress bar and auto-complete all freeze together.
  const rawNowMs = useNow();
  const nowMs = pausedNow(rawNowMs, pausedAtMs);
  const complete = workout ? isComplete(workout, nowMs) : false;
  const segmentIndex = workout ? segmentIndexAt(workout, nowMs) : null;
  const segment = segmentIndex !== null && workout ? workout.segments[segmentIndex] : null;
  const remaining = workout ? remainingMs(workout, nowMs) : null;
  const countdown = workout ? countdownMs(workout, nowMs) : null;
  const next = workout ? nextUp(workout, nowMs) : null;
  const totalLeft = workout ? totalRemainingMs(workout, nowMs) : 0;
  const questProgress = workout ? progress(workout, nowMs) : 0;

  // S5-05 — both completion paths (auto + foreground) funnel here: persist the
  // completion event to the outbox first (await: local write only, never the
  // network), then navigate. flush() runs fire-and-forget.
  const handoffToVictory = useCallback(
    async (completedQuestId: string) => {
      // AT-01D — the completion cue fires exactly once, on either the
      // auto-complete or the foreground-complete path.
      playCue('questComplete');
      const checkpoint = useWorkoutStore.getState().checkpoint;
      const startedAtEpochMs =
        checkpoint && checkpoint.questId === completedQuestId
          ? checkpoint.startedAtEpochMs
          : (workout?.startedAtEpochMs ?? Date.now());
      await finishQuest({
        questId: completedQuestId,
        startedAtEpochMs,
        workoutId: isCustom ? completedQuestId : undefined,
      });
      // NFR-9 — completion event persisted (outbox wrote), navigation happens.
      void track('quest_completed', { questId: completedQuestId });
      router.replace({
        pathname: '/victory',
        params: {
          questId: completedQuestId,
          title: params.title,
          ...(isCustom ? { source: 'custom' } : {}),
        },
      });
    },
    [params.title, router, workout, isCustom],
  );

  // WK-01 — pause freezes in place; resume shifts the start forward by the
  // pause length (both in memory and the persisted checkpoint) so remaining
  // time continues exactly where it stopped.
  const handlePause = useCallback(() => {
    if (!workout) {
      return;
    }
    const at = Date.now();
    setPausedAtMs(at);
    void useWorkoutStore.getState().pauseWorkout(at);
  }, [workout]);

  const handleResume = useCallback(() => {
    if (!workout || pausedAtMs === null) {
      return;
    }
    const shiftedStart = shiftStartForResume(workout.startedAtEpochMs, pausedAtMs, Date.now());
    setWorkout(buildWorkout(workout.segments, shiftedStart));
    setPausedAtMs(null);
    void useWorkoutStore.getState().resumeWorkout(shiftedStart);
  }, [workout, pausedAtMs]);

  // FR-TIMER-4 — auto-complete: replace, so back never re-enters a finished
  // workout (Ref 04 rule 3). The completion event is persisted to the outbox
  // first (S5-05); the network flush is fire-and-forget and victory consumes
  // the authoritative result once the sync lands.
  useEffect(() => {
    if (complete && !handledRef.current) {
      handledRef.current = true;
      void handoffToVictory(questId ?? '');
    }
  }, [complete, handoffToVictory, questId]);

  // S4-03 — foreground after a background pause (FR-TIMER-5/7, EC-2): the
  // engine already keeps rendering from the stored start instant ('resume' is
  // a no-op); an end that passed while backgrounded completes immediately.
  // WK-01 — a paused run is not running: a foreground return never completes
  // it; the screen stays frozen at the pause instant until Resume.
  useAppForeground(() => {
    const checkpoint = useWorkoutStore.getState().checkpoint;
    if (!checkpoint || !workout || handledRef.current) {
      return;
    }
    if (pausedAtMs !== null || checkpoint.pausedAtEpochMs != null) {
      return;
    }
    const decision = decideOnForeground(checkpoint, Date.now(), workout.segments);
    if (decision === 'complete') {
      handledRef.current = true;
      void handoffToVictory(questId ?? '');
    }
  });

  // Segment-change haptic (7.7) + timer cues (AT-01D/AT-01K sound set) —
  // derived from the engine index, not per-tick. One cue per transition:
  // restStart into a rest, restEnd out of a rest, exerciseEnd on any other
  // non-rest → non-rest switch (warmup→work, work→cooldown included).
  useEffect(() => {
    if (!workout || segmentIndex === null) {
      return;
    }
    const prevIndex = prevIndexRef.current;
    if (prevIndex === null) {
      prevIndexRef.current = segmentIndex; // prime: the first segment has no transition
      return;
    }
    if (segmentIndex === prevIndex) {
      return;
    }
    const prevKind = workout.segments[prevIndex]?.kind;
    const nextKind = workout.segments[segmentIndex]?.kind;
    if (prevKind && nextKind) {
      if (nextKind === 'rest') {
        playCue('restStart');
      } else if (prevKind === 'rest') {
        playCue('restEnd');
      } else {
        playCue('exerciseEnd');
      }
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prevIndexRef.current = segmentIndex;
  }, [segmentIndex, workout]);

  // EC-10 — screen-reader announcements. Segment changes are announced once
  // (name + kind); the countdown is announced only at full-minute boundaries
  // ("3 minutes left") — never the ticking digits themselves.
  const announcedSegmentRef = useRef<number | null>(null);
  useEffect(() => {
    if (segmentIndex === null || !workout) {
      return;
    }
    const seg = workout.segments[segmentIndex];
    if (!seg || announcedSegmentRef.current === segmentIndex) {
      return;
    }
    announcedSegmentRef.current = segmentIndex;
    const label = seg.kind === 'rest' ? 'Rest' : (names[segmentIndex] ?? 'Move');
    AccessibilityInfo.announceForAccessibility(`${label} — ${segmentKindLabel(seg.kind)}`);
  }, [names, segmentIndex, workout]);

  const announcedMinuteRef = useRef<number | null>(null);
  useEffect(() => {
    if (remaining === null) {
      return;
    }
    const minute = Math.floor(remaining / 60000);
    if (announcedMinuteRef.current === null) {
      announcedMinuteRef.current = minute; // settle without a first-frame announce
      return;
    }
    if (minute === announcedMinuteRef.current) {
      return;
    }
    announcedMinuteRef.current = minute;
    if (minute === 0) {
      AccessibilityInfo.announceForAccessibility('Less than a minute left');
    } else if (minute > 0) {
      AccessibilityInfo.announceForAccessibility(`${minute} minute${minute === 1 ? '' : 's'} left`);
    }
  }, [remaining]);

  // Android back during a workout = Quit Quest with the one allowed
  // confirmation sheet (Ref 04 rule 5, FR-TIMER-6). The explicit Quit button
  // has no confirmation and never passes through here. WK-01 — while paused,
  // back dismisses the pause overlay (resume) instead of quitting.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pausedAtMs !== null) {
        handleResume();
        return true;
      }
      setQuitVisible((visible) => !visible);
      return true;
    });
    return () => sub.remove();
  }, [pausedAtMs, handleResume]);

  const leaveQuest = useCallback(() => {
    setQuitVisible(false);
    // S4-03 — quit = run ends incomplete; no partial XP (FR-TIMER-7). Both
    // quit paths (button + sheet Leave) route through here, so the
    // checkpoint is always cleared exactly once.
    void useWorkoutStore.getState().clearWorkout();
    // Dismiss straight back to the detail screen the run came from (the
    // workout was presented as a full-screen modal, so this pops it without
    // stacking a duplicate). Customs return to their own detail page.
    router.dismissTo(
      isCustom
        ? { pathname: '/custom/[id]', params: { id: questId ?? '' } }
        : { pathname: '/quest/[id]', params: { id: questId ?? '' } },
    );
  }, [questId, router, isCustom]);

  const segmentName = segment
    ? segment.kind === 'rest'
      ? 'Rest'
      : (names[segmentIndex ?? -1] ?? 'Move')
    : null;
  const currentSlug =
    segment && segment.kind !== 'rest' ? (slugs[segmentIndex ?? -1] ?? null) : null;
  const heroSource = currentSlug ? exerciseArt(currentSlug) : null;
  const nextName = next
    ? next.kind === 'rest'
      ? 'Rest'
      : (names[(segmentIndex ?? -1) + 1] ?? 'Move')
    : null;
  const digits = remaining !== null ? formatCountdown(Math.ceil(remaining / 1000)) : null;
  const countdownDigit = countdown !== null ? String(countdown) : null;
  // WK-01 — the pause overlay shows the frozen segment's how-to + safety copy.
  const isRest = segment?.kind === 'rest';
  const currentInstruction = segment && !isRest ? (instructions[segmentIndex ?? -1] ?? null) : null;
  const currentSafetyNote = segment && !isRest ? (safetyNotes[segmentIndex ?? -1] ?? null) : null;
  // Rest step fallback copy
  const restDescription = 'Take a deep breath and let your muscles relax before the next interval.';
  const restSafetyTip = 'Stay loose — shake out your arms and legs while you wait.';
  // 3-2-1 countdown cue (AT-01K) — fires once when the roll-in begins, never
  // per digit change (the WAV itself ticks 3-2-1).
  const countdownActiveRef = useRef(false);
  useEffect(() => {
    const active = countdownDigit !== null;
    if (active && !countdownActiveRef.current) {
      playCue('countdown');
    }
    countdownActiveRef.current = active;
  }, [countdownDigit]);

  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.centered}>
          <View style={styles.skeletonDot} />
          <View style={styles.skeletonDigits} />
          <View style={styles.skeletonLine} />
        </View>
      </Screen>
    );
  }

  if (status === 'error' || !workout) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>This quest is hiding.</Text>
          <Text style={styles.errorLine}>Could not load its details. Try again in a moment.</Text>
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
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.screen}>
        <View style={styles.topRow}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.quitButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={withTapCue(leaveQuest)}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
            <Text style={styles.quitLabel}>Quit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.center}>
          {segment ? (
            <>
              {segment.kind === 'rest' ? (
                <Image
                  source={REST_DETAILED_ART}
                  style={[styles.hero, { width: heroWidth, height: heroHeight }]}
                  contentFit="contain"
                  accessibilityLabel="Rest"
                  transition={150}
                />
              ) : heroSource !== null ? (
                // AT-01D — exercise guide illustration per workout segment
                // (FR-TIMER-2b); no art → the screen renders exactly as before.
                <Image
                  source={heroSource}
                  style={[styles.hero, { width: heroWidth, height: heroHeight }]}
                  contentFit="contain"
                  accessibilityLabel={segmentName ?? 'Exercise'}
                  transition={150}
                />
              ) : null}
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: KIND_COLORS[segment.kind] }]}>
                  <Text style={styles.badgeLabel}>{segmentKindLabel(segment.kind)}</Text>
                </View>
              </View>
              <View style={styles.digitsBox}>
                {countdownDigit !== null ? (
                  // AT-01E — the 3-2-1 roll-in is shown INSTEAD of the ticking
                  // digits (never stacked on top of them); the engine keeps it
                  // a pre-phase that does not consume segment time.
                  <Text style={styles.countdownDigit}>{countdownDigit}</Text>
                ) : digits !== null ? (
                  <Text style={styles.digits}>{digits}</Text>
                ) : null}
              </View>
              <Text style={styles.segmentName}>{segmentName}</Text>
              {nextName !== null ? <Text style={styles.nextUp}>Next up: {nextName}</Text> : null}
            </>
          ) : (
            <Text style={styles.getReady}>Get ready…</Text>
          )}
        </View>

        <View style={styles.bottom}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                // NFR-5 — the bar advances with a transform (paint-only), never
                // a width/layout change per tick.
                { transform: [{ scaleX: questProgress }] },
              ]}
            />
          </View>
          <View style={styles.footerRow}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.pauseButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={withTapCue(pausedAtMs === null ? handlePause : handleResume)}
            >
              <Ionicons
                name={pausedAtMs === null ? 'pause' : 'play'}
                size={15}
                color={colors.textMuted}
              />
              <Text style={styles.pauseLabel}>{pausedAtMs === null ? 'Pause' : 'Resume'}</Text>
            </TouchableOpacity>
            <Text style={styles.footerLabel}>{formatTotalRemaining(totalLeft)} left</Text>
          </View>
        </View>
      </View>

      {/* WK-01 — paused overlay: frozen exercise art + name, its how-to copy
      and safety note, and the single way back into the run. */}
      <Modal
        visible={pausedAtMs !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={handleResume}
      >
        <View style={styles.pauseBackdrop}>
          <ScrollView
            style={styles.pauseScroll}
            contentContainerStyle={styles.pauseContent}
            showsVerticalScrollIndicator={false}
          >
            {isRest ? (
              <Image
                source={REST_DETAILED_ART}
                style={[styles.hero, { width: heroWidth, height: Math.round(heroHeight * 0.7) }]}
                contentFit="contain"
                accessibilityLabel="Rest"
                transition={150}
              />
            ) : heroSource !== null ? (
              <Image
                source={heroSource}
                style={[styles.hero, { width: heroWidth, height: Math.round(heroHeight * 0.7) }]}
                contentFit="contain"
                accessibilityLabel={segmentName ?? 'Exercise'}
                transition={150}
              />
            ) : null}
            <Text style={styles.pausedTitle}>Paused</Text>
            <Text style={styles.pausedName}>{segmentName ?? 'Move'}</Text>
            {currentInstruction !== null ? (
              <Text style={styles.pausedInstruction}>{currentInstruction}</Text>
            ) : isRest ? (
              <Text style={styles.pausedInstruction}>{restDescription}</Text>
            ) : null}
            {currentSafetyNote !== null ? (
              <View style={styles.safetyBox}>
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.calmStrong} />
                <Text style={styles.safetyText}>{currentSafetyNote}</Text>
              </View>
            ) : isRest ? (
              <View style={styles.safetyBox}>
                <Ionicons name="shield-checkmark-outline" size={14} color={colors.calmStrong} />
                <Text style={styles.safetyText}>{restSafetyTip}</Text>
              </View>
            ) : null}
          </ScrollView>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.resumeButton}
            onPress={withTapCue(handleResume)}
          >
            <Ionicons name="play" size={20} color={colors.background} />
            <Text style={styles.resumeLabel}>Resume</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={quitVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuitVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Leave this quest?</Text>
            <Text style={styles.sheetBody}>No XP is awarded — it stays open for another day.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.sheetLeave}
              onPress={withTapCue(leaveQuest)}
            >
              <Text style={styles.sheetLeaveLabel}>Leave</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.sheetCancel}
              onPress={withTapCue(() => setQuitVisible(false))}
            >
              <Text style={styles.sheetCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: 44,
  },
  quitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  quitLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  hero: {
    backgroundColor: '#1a1712',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  restSimpleBadge: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  badgeLabel: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  digitsBox: {
    height: COUNTDOWN_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digits: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: DIGIT_SIZE,
    lineHeight: COUNTDOWN_SIZE,
  },
  countdownDigit: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: COUNTDOWN_SIZE,
    lineHeight: COUNTDOWN_SIZE,
  },
  segmentName: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  nextUp: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
    textAlign: 'center',
  },
  getReady: {
    color: colors.textMuted,
    fontFamily: fonts.display.family,
    fontSize: 28,
  },
  bottom: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.reward,
    transformOrigin: 'left',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  pauseLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  pauseBackdrop: {
    flex: 1,
    backgroundColor: '#1a1712',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  pauseScroll: {
    flex: 1,
  },
  pauseContent: {
    alignItems: 'stretch',
    gap: spacing.md,
  },
  pausedTitle: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 18,
    letterSpacing: 1.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  pausedName: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
    textAlign: 'center',
  },
  pausedInstruction: {
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  safetyText: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  resumeButton: {
    minHeight: 52,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.reward,
  },
  resumeLabel: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 17,
  },
  footerLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  skeletonDot: {
    height: 24,
    width: 90,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonDigits: {
    height: 150,
    width: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  skeletonLine: {
    height: 18,
    width: 140,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
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
  sheetBackdrop: {
    flex: 1,
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
  sheetLeave: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  sheetLeaveLabel: {
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

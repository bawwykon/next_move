/**
 * JOURNEY-02 — chapter-unlock celebration overlay (display-only).
 *
 * Shown once when a workout completion advances `current_chapter`
 * (wired in `src/app/victory.tsx`: `chapter_after > chapter_before` drives
 * `visible`, with the `chapterUnlocked` cue from `expo-audio` via
 * `playCue('chapterUnlocked')` guarded to fire exactly once per unlock).
 *
 * Contract: full-screen semi-transparent black overlay, chapter badge
 * springs 0 → 1.0, chapter name fades in below, auto-dismiss after 2s,
 * tap dismisses early. Never crashes on missing chapter/art data — falls
 * back to text-only and returns null when not visible.
 */
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { CHAPTERS } from '@/domain/journey/chapter';
import { chapterArt, chapterBadgeArt } from '@/features/assets/assetMap';
import { colors, fonts, spacing } from '@/lib/theme';

/** Visible time before the overlay dismisses itself (JOURNEY-02: 2s). */
export const CHAPTER_CELEBRATION_DURATION_MS = 2000;

interface ChapterUnlockCelebrationProps {
  /** Show the full-screen celebration. False renders nothing. */
  visible: boolean;
  /** 1-based chapter id (CompletionResult `journey.chapter_after`). */
  chapterId: number;
  /** Fired on auto-dismiss (2s) and on tap-to-dismiss-early. */
  onDismiss?: () => void;
}

export function ChapterUnlockCelebration({
  visible,
  chapterId,
  onDismiss,
}: ChapterUnlockCelebrationProps) {
  const [scale] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  // Latest-dismiss ref: the 2s timer must not restart when the parent
  // re-renders with a new inline onDismiss identity (no replay on re-render).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Safe lookups: unknown ids fall back to a generic label and text-only
  // art (null badge skips the image) — the overlay can never crash.
  const chapter = CHAPTERS[chapterId - 1] ?? null;
  const chapterName =
    chapter !== null ? `Chapter ${chapter.id}: ${chapter.name}` : `Chapter ${chapterId}`;
  // Badge-pin art first (matches the journey map pins), emblem fallback.
  // Both are existing assetMap exports (not renamed).
  const badge = chapterBadgeArt(chapterId) ?? chapterArt(chapterId);

  useEffect(() => {
    if (!visible) {
      return;
    }
    scale.setValue(0);
    fade.setValue(0);
    const pop = Animated.spring(scale, { toValue: 1, useNativeDriver: true });
    const textIn = Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    });
    pop.start();
    textIn.start();
    const timer = setTimeout(() => {
      onDismissRef.current?.();
    }, CHAPTER_CELEBRATION_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [visible, scale, fade]);

  if (!visible) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Dismiss chapter unlock celebration: ${chapterName}`}
      onPress={onDismiss}
      style={styles.backdrop}
      testID="chapter-unlock-celebration"
    >
      <Animated.View
        style={[styles.badgeWrap, { transform: [{ scale }] }]}
        testID="chapter-unlock-celebration-badge"
      >
        {badge !== null ? (
          <Image
            source={badge}
            style={styles.badge}
            contentFit="contain"
            accessibilityLabel="Chapter badge"
          />
        ) : null}
      </Animated.View>
      <Animated.View
        style={[styles.textWrap, { opacity: fade }]}
        testID="chapter-unlock-celebration-name"
      >
        <Text style={styles.kicker}>Chapter Unlocked</Text>
        <Text style={styles.chapterName}>{chapterName}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xxxl,
  },
  badgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 160,
    height: 160,
  },
  textWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  kicker: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  chapterName: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
    textAlign: 'center',
  },
});

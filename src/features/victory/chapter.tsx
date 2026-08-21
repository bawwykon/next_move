import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

import { chapterArt } from '@/features/assets/assetMap';
import { CHAPTERS } from '@/domain/journey/chapter';
import { colors, fonts, radius, spacing } from '@/lib/theme';

interface ChapterOverlayProps {
  /** Fades the flash card in (and back out when it turns false). */
  visible: boolean;
  /** chapter_after — 1-based CHAPTERS id. */
  chapterId: number;
}

/**
 * AT-02D — chapter celebration, the final victory beat: a quick full-screen
 * moment that reads after the level-up flash (or straight after the initial
 * burst when there was no level-up). The card scales + fades in with the
 * chapter emblem; it re-fades out as the parent hides it, and never blocks
 * taps underneath (pointerEvents none while fading).
 */
export function ChapterOverlay({ visible, chapterId }: ChapterOverlayProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const chapter = CHAPTERS[chapterId - 1];

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 320,
      easing: visible ? Easing.out(Easing.back(1.6)) : Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const art = chapterArt(chapterId);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.backdrop, { opacity }]}
      accessibilityViewIsModal={visible}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {art !== null ? (
          <Image
            source={art}
            style={styles.emblem}
            contentFit="contain"
            accessibilityLabel="Chapter emblem"
          />
        ) : null}
        <Text style={styles.kicker}>Chapter Unlocked</Text>
        <Text style={styles.chapterName}>{chapter?.name ?? `Chapter ${chapterId}`}</Text>
        <Text style={styles.line}>
          You&apos;ve reached {chapter?.name ?? `Chapter ${chapterId}`} — your adventure is growing.
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 23, 18, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.calmStrong,
    borderWidth: 2,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emblem: {
    width: 96,
    height: 96,
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
  line: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});

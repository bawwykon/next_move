import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, spacing } from '@/lib/theme';

interface LevelUpOverlayProps {
  /** Fades the flash card in (and back out when it turns false). */
  visible: boolean;
  level: number;
  title: string;
}

/**
 * S6-01 — FR-XP-4 level-up flash: a quick full-screen moment that reads
 * before the payload details. The card scales + fades in; it re-fades out as
 * the parent hides it, and never blocks taps underneath (pointerEvents none
 * while fading).
 */
export function LevelUpOverlay({ visible, level, title }: LevelUpOverlayProps) {
  const [progress] = useState(() => new Animated.Value(0));

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

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.backdrop, { opacity }]}
      accessibilityViewIsModal={visible}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.levelUp}>Level Up!</Text>
        <Text style={styles.levelNumber}>Level {level}</Text>
        <Text style={styles.levelTitle}>{title}</Text>
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
    borderColor: colors.reward,
    borderWidth: 2,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  levelUp: {
    color: colors.reward,
    fontFamily: fonts.display.family,
    fontSize: 40,
  },
  levelNumber: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
  },
  levelTitle: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 16,
  },
});

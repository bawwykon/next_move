import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors } from '@/lib/theme';

/**
 * S6-01 — code-drawn confetti (no assets): ~40 Animated squares drift down
 * from the top of the screen with a spin, then fade out. `runId` restarts the
 * burst, so the level-up moment can re-launch it over the synced payload.
 *
 * The burst is built inside an effect (not during render), so the random
 * spread never recomputes on every frame of the celebration.
 */
const PIECE_COUNT = 40;
const FALL_COLORS = [
  colors.reward,
  colors.rewardStrong,
  colors.calm,
  colors.calmStrong,
  colors.success,
  colors.danger,
];

interface Piece {
  anim: Animated.Value;
  x: number;
  drift: number;
  fall: number;
  spin: number;
  size: number;
  color: string;
  round: boolean;
  delay: number;
  duration: number;
}

interface ConfettiBurstProps {
  /** 0 = hidden; bump to >0 (or +1) to (re)launch the burst. */
  runId: number;
}

function createPieces(width: number, height: number): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    anim: new Animated.Value(0),
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * width * 0.5,
    fall: height + 120 + Math.random() * 160,
    spin: Math.random() * 720 - 360,
    size: 6 + Math.random() * 6,
    color: FALL_COLORS[i % FALL_COLORS.length]!,
    round: i % 3 === 0,
    delay: Math.random() * 300,
    duration: 1400 + Math.random() * 1000,
  }));
}

export function ConfettiBurst({ runId }: ConfettiBurstProps) {
  const { width, height } = useWindowDimensions();
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [pieces] = useState<Piece[]>(() => createPieces(width, height));

  // Every runId bump restarts the same laid-out burst (values reset, timing
  // replay) — the layout is built once at mount, never during a frame render.
  useEffect(() => {
    animRef.current?.stop();
    for (const piece of pieces) {
      piece.anim.setValue(0);
    }
    if (runId <= 0) {
      return;
    }
    const burst = Animated.parallel(
      pieces.map((piece) =>
        Animated.timing(piece.anim, {
          toValue: 1,
          duration: piece.duration,
          delay: piece.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ),
      { stopTogether: false },
    );
    animRef.current = burst;
    burst.start();
    return () => {
      animRef.current?.stop();
    };
  }, [pieces, runId]);

  if (runId <= 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => {
        const translateX = piece.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, piece.drift],
        });
        const translateY = piece.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-24, piece.fall],
        });
        const rotate = piece.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${piece.spin}deg`],
        });
        const opacity = piece.anim.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.piece,
              {
                left: piece.x,
                width: piece.size,
                height: piece.size,
                borderRadius: piece.round ? piece.size / 2 : 2,
                backgroundColor: piece.color,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
  },
});

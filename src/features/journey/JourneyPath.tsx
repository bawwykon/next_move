/**
 * JOURNEY-01 — code-drawn vertical path connecting chapter nodes.
 * Each segment has a dim background track + a bright fill line on top.
 * This ensures the path is always visible between nodes.
 */
import { StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';
import type { ChapterState } from './useJourneyState';

interface PathSegmentProps {
  fromState: ChapterState;
  toState: ChapterState;
  height: number;
}

function segmentColor(from: ChapterState, to: ChapterState): string {
  if (from === 'completed' && to === 'completed') return colors.reward;
  if (from === 'completed' && to === 'current') return colors.reward;
  if (from === 'current' && to === 'locked') return colors.textMuted;
  return colors.textMuted;
}

function PathSegment({ fromState, toState, height }: PathSegmentProps) {
  const color = segmentColor(fromState, toState);
  const isLocked = fromState === 'locked' && toState === 'locked';
  const isGlowing = fromState === 'current' || toState === 'current';

  return (
    <View style={[styles.segmentContainer, { height }]}>
      {/* Background track — always visible */}
      <View style={styles.track} />
      {/* Bright fill line on top */}
      <View
        style={[
          styles.segment,
          {
            backgroundColor: isLocked ? 'transparent' : color,
            borderWidth: isLocked ? 2 : 0,
            borderColor: isLocked ? colors.textMuted : 'transparent',
            borderStyle: isLocked ? 'dashed' : 'solid',
          },
        ]}
      />
      {/* Glow for current chapter transition */}
      {isGlowing ? <View style={[styles.glow, { backgroundColor: color }]} /> : null}
    </View>
  );
}

interface JourneyPathProps {
  segmentStates: { from: ChapterState; to: ChapterState }[];
  segmentHeight: number;
}

export function JourneyPath({ segmentStates, segmentHeight }: JourneyPathProps) {
  return (
    <View style={styles.pathColumn}>
      {segmentStates.map((seg, i) => (
        <PathSegment
          key={`path-${i}`}
          fromState={seg.from}
          toState={seg.to}
          height={segmentHeight}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pathColumn: {
    alignItems: 'center',
  },
  segmentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    width: 4,
    height: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
  },
  segment: {
    position: 'absolute',
    width: 8,
    height: '100%',
    borderRadius: 4,
  },
  glow: {
    position: 'absolute',
    width: 20,
    height: '100%',
    borderRadius: 10,
    opacity: 0.35,
  },
});

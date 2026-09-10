/**
 * JOURNEY-01 — main journey map (ScrollView + vertical path + nodes).
 * Center-aligned adventure path with connected nodes.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing } from '@/lib/theme';
import { ChapterDetailSheet } from './ChapterDetailSheet';
import { ChapterNode } from './ChapterNode';
import { CurrentChapterPanel } from './CurrentChapterPanel';
import { JourneyPath } from './JourneyPath';
import { useJourneyState, type ChapterState } from './useJourneyState';
import { withTapCue } from '@/lib/sounds';

const SEGMENT_HEIGHT = 56;

interface JourneyMapProps {
  journeyQuestCount: number;
}

export function JourneyMap({ journeyQuestCount }: JourneyMapProps) {
  const { chapters, currentChapter } = useJourneyState(journeyQuestCount);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedChapter =
    selectedId !== null ? (chapters.find((c) => c.data.id === selectedId) ?? null) : null;

  const handlePress = useCallback((id: number) => {
    withTapCue(() => setSelectedId(id))();
  }, []);

  const handleClose = useCallback(() => setSelectedId(null), []);

  // Build segment states: segment[i] connects node[i] to node[i+1]
  const segmentStates: { from: ChapterState; to: ChapterState }[] = [];
  for (let i = 0; i < chapters.length - 1; i++) {
    segmentStates.push({ from: chapters[i]!.state, to: chapters[i + 1]!.state });
  }

  return (
    <View style={styles.container}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Journey</Text>
        <Text style={styles.subtitle}>{journeyQuestCount} quests completed</Text>
      </View>

      {/* Centered adventure path */}
      <View style={styles.pathColumn}>
        {chapters.map((chapter, index) => (
          <View key={chapter.data.id}>
            {/* Node centered on path */}
            <ChapterNode
              chapter={chapter.data}
              state={chapter.state}
              fraction={chapter.fraction}
              isCurrent={chapter.state === 'current'}
              onPress={handlePress}
            />
            {/* Path segment below node (except last) */}
            {index < chapters.length - 1 ? (
              <JourneyPath segmentStates={[segmentStates[index]!]} segmentHeight={SEGMENT_HEIGHT} />
            ) : null}
          </View>
        ))}
      </View>

      {/* Current chapter panel */}
      {currentChapter ? (
        <View style={styles.panelContainer}>
          <CurrentChapterPanel chapter={currentChapter} />
        </View>
      ) : null}

      {/* Detail sheet */}
      <ChapterDetailSheet
        visible={selectedChapter !== null}
        chapter={selectedChapter?.data ?? null}
        state={selectedChapter?.state ?? 'locked'}
        fraction={selectedChapter?.fraction ?? 0}
        questsInChapter={selectedChapter?.questsInChapter ?? 0}
        span={selectedChapter?.span ?? null}
        onClose={handleClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 26,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 15,
  },
  pathColumn: {
    alignItems: 'center',
    gap: 0,
  },
  panelContainer: {
    marginTop: spacing.lg,
  },
});

/**
 * RealJourneyMap.tsx — Interactive 3D Isometric Adventure World Map.
 *
 * Implements the full spec from Next_Move_Real_Journey_Map_Spec.md:
 * - Continuous high-resolution world map canvas (Village -> Training Grounds ->
 *   Wild Forest -> River Bridge -> Mountain Ascent -> Fortress -> Mastery Peak)
 * - Quest-based player movement along the physical trail coordinates
 * - 7 Chapter Shield Badges (1..7) with interactive details and completion states
 * - Glowing waypoint path nodes
 * - Auto-centering camera on current player position
 * - Floating Chapter Progress HUD
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  chapterBadgeArt,
  JOURNEY_MAP_BG,
  PATH_NODE_GLOWING,
  PLAYER_MAP_TOKEN,
} from '@/features/assets/assetMap';
import { withTapCue } from '@/lib/sounds';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { ChapterDetailSheet } from './ChapterDetailSheet';
import { useJourneyState } from './useJourneyState';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Map aspect ratio is 887 x 1774 (1 : 2)
const MAP_WIDTH = SCREEN_WIDTH;
const MAP_HEIGHT = Math.round(SCREEN_WIDTH * 2.0); // Exact 1:2.0 match for 887x1774 artwork

// Waypoints along the winding dirt/stone trail from Village (bottom) to Summit (top)
// Coordinates in percentage (0..100) of map dimensions
export interface TrailWaypoint {
  quest: number;
  x: number;
  y: number;
}

const TRAIL_WAYPOINTS: TrailWaypoint[] = [
  // Chapter 1: The First Step (0-10 quests) — Village
  { quest: 0, x: 47.0, y: 94.5 },
  { quest: 3, x: 47.5, y: 90.0 },
  { quest: 7, x: 53.0, y: 84.5 }, // Fills the empty village exit road
  { quest: 10, x: 55.5, y: 78.5 },

  // Chapter 2: Training Grounds (10-30 quests)
  { quest: 15, x: 56.5, y: 74.0 },
  { quest: 20, x: 53.5, y: 73.0 }, // Village exit bend
  { quest: 25, x: 54.0, y: 66.0 },
  { quest: 30, x: 56.0, y: 64.0 },

  // Chapter 3: Into the Wild (30-60 quests) — Forest Curve
  { quest: 38, x: 68.0, y: 58.5 },
  { quest: 45, x: 62.0, y: 56.5 }, // Dirt curve center
  { quest: 53, x: 58.0, y: 51.5 },
  { quest: 60, x: 48.0, y: 49.5 },

  // Chapter 4: Crossing the Bridge (60-100 quests)
  { quest: 70, x: 47.0, y: 45.5 }, // Stone bridge threshold
  { quest: 80, x: 38.0, y: 44.5 }, // On stone bridge
  { quest: 90, x: 41.0, y: 41.5 },
  { quest: 100, x: 51.5, y: 39.5 },

  // Chapter 5: The Ascent (100-200 quests) — Mountain Switchbacks
  { quest: 125, x: 54.0, y: 35.0 }, // Center of stone path (was 52.0 on cliff)
  { quest: 150, x: 56.5, y: 31.5 },
  { quest: 175, x: 58.0, y: 30.0 }, // Stone stair step
  { quest: 200, x: 64.0, y: 25.5 },

  // Chapter 6: Fortress of Discipline (200-365 quests)
  { quest: 240, x: 66.5, y: 21.5 },
  { quest: 280, x: 61.5, y: 17.5 },
  { quest: 320, x: 58.0, y: 12.5 },
  { quest: 340, x: 55.0, y: 10.0 }, // Upper mountain road curve below peak
  { quest: 365, x: 56.5, y: 6.5 },
];

// Explicit node placements along the road centerline (eliminates gaps & off-road pins)
const GLOWING_NODE_INDICES = [1, 2, 4, 6, 8, 13, 15, 17, 19, 21, 23];

export interface ChapterPin {
  id: number;
  badgeX: number; // percentage
  badgeY: number; // percentage
  align: 'left' | 'right' | 'bottom';
}

const CHAPTER_PINS: ChapterPin[] = [
  { id: 1, badgeX: 9, badgeY: 91.5, align: 'right' },
  { id: 2, badgeX: 88, badgeY: 76.5, align: 'left' },
  { id: 3, badgeX: 8, badgeY: 66.5, align: 'right' },
  { id: 4, badgeX: 88, badgeY: 50.0, align: 'left' },
  { id: 5, badgeX: 10, badgeY: 35.5, align: 'right' },
  { id: 6, badgeX: 86, badgeY: 28.5, align: 'left' },
  { id: 7, badgeX: 19, badgeY: 10.0, align: 'right' },
];

// Calculate player (x, y) along trail for any quest count
function getPlayerPosition(quests: number): { x: number; y: number } {
  if (quests <= 0) {
    return { x: TRAIL_WAYPOINTS[0]!.x, y: TRAIL_WAYPOINTS[0]!.y };
  }
  const last = TRAIL_WAYPOINTS[TRAIL_WAYPOINTS.length - 1]!;
  if (quests >= last.quest) {
    return { x: last.x, y: last.y };
  }
  for (let i = 0; i < TRAIL_WAYPOINTS.length - 1; i++) {
    const curr = TRAIL_WAYPOINTS[i]!;
    const next = TRAIL_WAYPOINTS[i + 1]!;
    if (quests >= curr.quest && quests <= next.quest) {
      const span = next.quest - curr.quest;
      const t = span > 0 ? (quests - curr.quest) / span : 0;
      return {
        x: curr.x + t * (next.x - curr.x),
        y: curr.y + t * (next.y - curr.y),
      };
    }
  }
  return { x: last.x, y: last.y };
}

interface RealJourneyMapProps {
  journeyQuestCount: number;
  refreshing: boolean;
  onRefresh: () => void;
}

export function RealJourneyMap({ journeyQuestCount, refreshing, onRefresh }: RealJourneyMapProps) {
  const { chapters, currentChapter } = useJourneyState(journeyQuestCount);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showPlayerToken, setShowPlayerToken] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const [hasScrolledInitial, setHasScrolledInitial] = useState(false);

  // Player token bobbing animation
  const [bounceAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // The bob loop runs on the native driver bound to the token view, so it
    // dies with the view when hidden. Restart it every time the token shows.
    if (!showPlayerToken) {
      return;
    }
    bounceAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -6,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounceAnim, showPlayerToken]);

  const playerPos = useMemo(() => getPlayerPosition(journeyQuestCount), [journeyQuestCount]);

  const selectedChapter =
    selectedId !== null ? (chapters.find((c) => c.data.id === selectedId) ?? null) : null;

  const handlePressChapter = useCallback((id: number) => {
    withTapCue(() => setSelectedId(id))();
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
  }, []);

  // Center camera on player position once layout is known
  const handleMapLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (hasScrolledInitial) return;
      const mapActualHeight = e.nativeEvent.layout.height;
      const playerPixelY = (playerPos.y / 100) * mapActualHeight;
      const targetScrollY = Math.max(0, playerPixelY - SCREEN_HEIGHT / 2 + 60);

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: targetScrollY, animated: false });
        setHasScrolledInitial(true);
      }, 100);
    },
    [playerPos.y, hasScrolledInitial],
  );

  return (
    <View style={styles.container}>
      {/* Main Interactive Map ScrollView */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFD700"
            colors={['#FFD700']}
            progressViewOffset={80}
          />
        }
      >
        <View style={styles.mapCanvas} onLayout={handleMapLayout}>
          {/* Background Map Art */}
          <Image
            source={JOURNEY_MAP_BG}
            style={styles.mapBackground}
            contentFit="cover"
            priority="high"
          />

          {/* Intermediate Glowing Waypoint Nodes along the Trail */}
          {GLOWING_NODE_INDICES.map((wpIndex) => {
            const wp = TRAIL_WAYPOINTS[wpIndex]!;
            const isReached = journeyQuestCount >= wp.quest;
            const px = (wp.x / 100) * MAP_WIDTH;
            const py = (wp.y / 100) * MAP_HEIGHT;
            return (
              <View
                key={`wp-${wpIndex}`}
                style={[
                  styles.waypointWrap,
                  {
                    left: px - 11,
                    top: py - 11,
                    opacity: isReached ? 1 : 0.45,
                  },
                ]}
                pointerEvents="none"
              >
                <Image
                  source={PATH_NODE_GLOWING}
                  style={styles.waypointImage}
                  contentFit="contain"
                />
              </View>
            );
          })}

          {/* 7 Interactive Chapter Badges & Banner Pins */}
          {CHAPTER_PINS.map((pin) => {
            const chapter = chapters.find((c) => c.data.id === pin.id);
            if (!chapter) return null;

            const badgeArt = chapterBadgeArt(pin.id);
            const isCurrent = chapter.state === 'current';
            const isCompleted = chapter.state === 'completed';
            const isLocked = chapter.state === 'locked';
            const isMastered = chapter.data.id === 7 && chapter.fraction >= 1;

            const badgeLeft = (pin.badgeX / 100) * MAP_WIDTH - 22;
            const badgeTop = (pin.badgeY / 100) * MAP_HEIGHT - 34;

            return (
              <View
                key={`chapter-${pin.id}`}
                style={[
                  styles.chapterPinContainer,
                  {
                    left: badgeLeft,
                    top: badgeTop,
                  },
                ]}
              >
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${chapter.data.name} - ${isCompleted ? 'Completed' : isCurrent ? 'Current Chapter' : 'Locked'}`}
                  style={[
                    styles.badgeTouchTarget,
                    isCurrent && styles.badgeCurrentHalo,
                    isLocked && styles.badgeLockedOpacity,
                  ]}
                  onPress={() => handlePressChapter(pin.id)}
                  activeOpacity={0.85}
                >
                  {badgeArt ? (
                    <Image source={badgeArt} style={styles.badgeImage} contentFit="contain" />
                  ) : null}

                  {/* Completed Checkmark Emblem */}
                  {isCompleted ? (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark-sharp" size={14} color="#1A1208" />
                    </View>
                  ) : null}

                  {/* Current Active Pulsing Indicator */}
                  {isCurrent ? (
                    <View style={styles.currentIndicatorPulse}>
                      <Text style={styles.currentIndicatorText}>YOU</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                {/* Floating Chapter Info Pill */}
                <Pressable
                  style={[
                    styles.chapterPill,
                    pin.align === 'left'
                      ? styles.pillLeft
                      : pin.align === 'right'
                        ? styles.pillRight
                        : styles.pillBottom,
                    isCurrent && styles.chapterPillCurrent,
                    isLocked && styles.chapterPillLocked,
                  ]}
                  onPress={() => handlePressChapter(pin.id)}
                >
                  <Text
                    style={[
                      styles.pillChapterName,
                      (isCompleted || isMastered) && styles.pillNameCompleted,
                      isCurrent && !isMastered && styles.pillNameCurrent,
                    ]}
                    numberOfLines={2}
                  >
                    {chapter.data.name}
                  </Text>
                  <Text style={styles.pillProgress}>
                    {isCompleted
                      ? 'Completed'
                      : isCurrent
                        ? chapter.data.id === 7 && chapter.fraction >= 1
                          ? '365 / 365 quests'
                          : `${chapter.questsInChapter} / ${chapter.span ?? chapter.data.threshold} quests`
                        : `Reach ${chapter.data.threshold} quests`}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          {/* Animated Player Map Token */}
          {showPlayerToken ? (
            <Animated.View
              style={[
                styles.playerTokenContainer,
                {
                  left: (playerPos.x / 100) * MAP_WIDTH - 28,
                  top: (playerPos.y / 100) * MAP_HEIGHT - 54,
                  transform: [{ translateY: bounceAnim }],
                },
              ]}
              pointerEvents="none"
            >
              {/* Glowing Aura under pedestal */}
              <View style={styles.playerPedestalAura} />
              <Image
                source={PLAYER_MAP_TOKEN}
                style={styles.playerTokenImage}
                contentFit="contain"
              />
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating Bottom HUD Card — Current Chapter Status */}
      {currentChapter ? (
        <View style={styles.floatingBottomHud}>
          <TouchableOpacity
            style={styles.hudCard}
            activeOpacity={0.9}
            onPress={() => handlePressChapter(currentChapter.data.id)}
          >
            <View style={styles.hudBadgeWrap}>
              {chapterBadgeArt(currentChapter.data.id) ? (
                <Image
                  source={chapterBadgeArt(currentChapter.data.id)!}
                  style={styles.hudBadgeImage}
                  contentFit="contain"
                />
              ) : null}
            </View>

            <View style={styles.hudContent}>
              <View style={styles.hudHeaderRow}>
                <Text style={styles.hudChapterName} numberOfLines={1}>
                  Chapter {currentChapter.data.id} · {currentChapter.data.name}
                </Text>
                <Text style={styles.hudQuestCount}>
                  {currentChapter.data.id === 7 &&
                  currentChapter.questsInChapter === 0 &&
                  currentChapter.fraction >= 1
                    ? '365 / 365'
                    : `${currentChapter.questsInChapter} / ${currentChapter.span ?? currentChapter.data.threshold}`}
                </Text>
              </View>

              <Text style={styles.hudFlavor} numberOfLines={2}>
                {currentChapter.data.flavor}
              </Text>

              {/* Progress Bar */}
              <View style={styles.hudBarTrack}>
                <View
                  style={[
                    styles.hudBarFill,
                    { width: `${Math.round(currentChapter.fraction * 100)}%` },
                  ]}
                />
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.reward} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Player Token Show/Hide Toggle */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={showPlayerToken ? 'Hide player token' : 'Show player token'}
        style={styles.tokenToggle}
        activeOpacity={0.8}
        onPress={withTapCue(() => setShowPlayerToken((visible) => !visible))}
      >
        <Ionicons name={showPlayerToken ? 'eye' : 'eye-off'} size={22} color={colors.reward} />
      </TouchableOpacity>

      {/* Chapter Detail Bottom Sheet */}
      <ChapterDetailSheet
        visible={selectedChapter !== null}
        chapter={selectedChapter?.data ?? null}
        state={selectedChapter?.state ?? 'locked'}
        fraction={selectedChapter?.fraction ?? 0}
        questsInChapter={selectedChapter?.questsInChapter ?? 0}
        span={selectedChapter?.span ?? null}
        onClose={handleCloseDetail}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1216',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 110, // room for floating HUD
  },
  mapCanvas: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    position: 'relative',
  },
  mapBackground: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  },
  waypointWrap: {
    position: 'absolute',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  waypointImage: {
    width: 22,
    height: 22,
  },
  chapterPinContainer: {
    position: 'absolute',
    zIndex: 4,
    alignItems: 'center',
  },
  badgeTouchTarget: {
    width: 46,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeImage: {
    width: 44,
    height: 68,
  },
  badgeCurrentHalo: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  badgeLockedOpacity: {
    opacity: 0.6,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0F1216',
  },
  currentIndicatorPulse: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#FFD700',
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#0F1216',
  },
  currentIndicatorText: {
    color: '#0F1216',
    fontFamily: fonts.bodyBold.family,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  chapterPill: {
    position: 'absolute',
    backgroundColor: 'rgba(16, 20, 26, 0.92)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    minWidth: 100,
    maxWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  pillRight: {
    left: 48,
    top: 14,
  },
  pillLeft: {
    right: 48,
    top: 14,
  },
  pillBottom: {
    left: -40,
    top: 74,
  },
  chapterPillCurrent: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(24, 28, 38, 0.96)',
  },
  chapterPillLocked: {
    borderColor: 'rgba(255, 255, 255, 0.15)',
    opacity: 0.75,
  },
  pillChapterName: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 11,
    lineHeight: 14,
    flexShrink: 0,
  },
  pillNameCompleted: {
    color: '#FFD700',
  },
  pillNameCurrent: {
    color: '#FFF8E7',
  },
  pillProgress: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 9,
    marginTop: 1,
  },
  playerTokenContainer: {
    position: 'absolute',
    width: 56,
    height: 76,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 6,
  },
  playerPedestalAura: {
    position: 'absolute',
    bottom: 2,
    width: 44,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.45)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
  },
  playerTokenImage: {
    width: 56,
    height: 76,
  },
  tokenToggle: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 150,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 20, 26, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  floatingBottomHud: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
  },
  hudCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 20, 26, 0.95)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.reward,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
    gap: spacing.md,
  },
  hudBadgeWrap: {
    width: 38,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudBadgeImage: {
    width: 36,
    height: 52,
  },
  hudContent: {
    flex: 1,
    gap: 3,
  },
  hudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hudChapterName: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 13,
    flex: 1,
  },
  hudQuestCount: {
    color: colors.reward,
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
  },
  hudFlavor: {
    color: colors.textMuted,
    fontFamily: fonts.body.family,
    fontSize: 11,
    fontStyle: 'italic',
  },
  hudBarTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    marginTop: 2,
  },
  hudBarFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.reward,
  },
});

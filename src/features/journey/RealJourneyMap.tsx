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
import { useTranslation } from 'react-i18next';
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
  TOKEN_EYE_MEDALLION,
} from '@/features/assets/assetMap';
import { getPlayerPosition, TRAIL_WAYPOINTS } from '@/domain/journey/trail';
import { withTapCue } from '@/lib/sounds';
import { colors, fonts, radius, spacing } from '@/lib/theme';
import { ChapterDetailSheet } from './ChapterDetailSheet';
import { useJourneyState } from './useJourneyState';
import { WorldQuestsTab } from './WorldQuestsTab';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Map aspect ratio is 887 x 1774 (1 : 2)
const MAP_WIDTH = SCREEN_WIDTH;
const MAP_HEIGHT = Math.round(SCREEN_WIDTH * 2.0); // Exact 1:2.0 match for 887x1774 artwork

// Trail shape + chapter-paced position live in @/domain/journey/trail
// (testable, no I/O). Waypoint `quest` labels below are polyline anchors;
// pacing derives from chapter thresholds, not from these labels.

// 15 glowing path pins in travel order (pin 16 removed per owner)
// Hidden per owner — data kept so the dots can return anytime.
const GLOWING_NODE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const SHOW_GLOW_PINS = false;

export interface ChapterPin {
  id: number;
  badgeX: number; // percentage
  badgeY: number; // percentage
  align: 'left' | 'right' | 'bottom';
}

const CHAPTER_PINS: ChapterPin[] = [
  { id: 1, badgeX: 9, badgeY: 88.0, align: 'right' },
  { id: 2, badgeX: 90, badgeY: 72.0, align: 'left' },
  { id: 3, badgeX: 8, badgeY: 60.0, align: 'right' },
  { id: 4, badgeX: 9, badgeY: 42.0, align: 'right' },
  { id: 5, badgeX: 90, badgeY: 34.0, align: 'left' },
  { id: 6, badgeX: 8, badgeY: 24.0, align: 'right' },
  { id: 7, badgeX: 86, badgeY: 6.0, align: 'left' },
];

// Owner calibration mode: gold path pins become numbered + draggable in-app.
// Drag each dot into place, tap Export, send the logged coordinates back —
// then this flag goes back to false and the positions get baked in.
const CALIBRATE_PATH_PINS = false;

interface CalibratePinProps {
  index: number;
  orderNo: number;
  baseX: number;
  baseY: number;
  reached: boolean;
  onCommit: (index: number, x: number, y: number) => void;
  onDragState: (dragging: boolean) => void;
}

function CalibratePin({
  index,
  orderNo,
  baseX,
  baseY,
  reached,
  onCommit,
  onDragState,
}: CalibratePinProps) {
  const [grant, setGrant] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const px = (baseX / 100) * MAP_WIDTH + drag.dx;
  const py = (baseY / 100) * MAP_HEIGHT + drag.dy;
  return (
    <View
      style={[styles.calibrateHit, { left: px - 32, top: py - 32 }]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        onDragState(true);
        setGrant({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
        setDrag({ dx: 0, dy: 0 });
      }}
      onResponderMove={(e) => {
        if (grant !== null) {
          setDrag({ dx: e.nativeEvent.pageX - grant.x, dy: e.nativeEvent.pageY - grant.y });
        }
      }}
      onResponderRelease={(e) => {
        onDragState(false);
        if (grant !== null) {
          onCommit(
            index,
            baseX + ((e.nativeEvent.pageX - grant.x) / MAP_WIDTH) * 100,
            baseY + ((e.nativeEvent.pageY - grant.y) / MAP_HEIGHT) * 100,
          );
        }
        setGrant(null);
        setDrag({ dx: 0, dy: 0 });
      }}
      onResponderTerminate={() => {
        onDragState(false);
        setGrant(null);
        setDrag({ dx: 0, dy: 0 });
      }}
    >
      <Image
        source={PATH_NODE_GLOWING}
        style={[styles.waypointImage, { opacity: reached ? 1 : 0.45 }]}
        contentFit="contain"
      />
      <View style={styles.calibrateTag}>
        <Text style={styles.calibrateTagText}>{orderNo}</Text>
      </View>
    </View>
  );
}

interface RealJourneyMapProps {
  journeyQuestCount: number;
  refreshing: boolean;
  onRefresh: () => void;
}

export function RealJourneyMap({ journeyQuestCount, refreshing, onRefresh }: RealJourneyMapProps) {
  const { t } = useTranslation();
  const { chapters, currentChapter } = useJourneyState(journeyQuestCount, t);
  // Full-bleed map: art runs under the status bar by design (owner call).
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showPlayerToken, setShowPlayerToken] = useState(true);
  const [pinOverrides, setPinOverrides] = useState<
    Readonly<Record<number, { x: number; y: number }>>
  >(() => ({}));
  const [draggingPin, setDraggingPin] = useState(false);
  const handlePinDragState = useCallback((dragging: boolean) => {
    setDraggingPin(dragging);
  }, []);
  const handleCommitPin = useCallback((index: number, x: number, y: number) => {
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    setPinOverrides((prev) => ({ ...prev, [index]: { x: rx, y: ry } }));
  }, []);
  const handleExportPins = useCallback(() => {
    console.log('PINOUT BEGIN');
    for (let i = 0; i < TRAIL_WAYPOINTS.length; i++) {
      const w = TRAIL_WAYPOINTS[i]!;
      const o = pinOverrides[i];
      const x = (o ? o.x : w.x).toFixed(1);
      const y = (o ? o.y : w.y).toFixed(1);
      console.log('PINOUT { quest: ' + w.quest + ', x: ' + x + ', y: ' + y + ' },');
    }
    console.log('PINOUT END');
  }, [pinOverrides]);
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

  // Token walk glide: position animates on the JS driver (layout props) while
  // the bob below stays on the native driver — nested views so they never
  // fight. First paint snaps (no glide from 0,0); later count changes glide
  // ~0.9s to the new trail spot instead of teleporting.
  const [tokenLeft] = useState(() => new Animated.Value(0));
  const [tokenTop] = useState(() => new Animated.Value(0));
  const tokenPlaced = useRef(false);
  useEffect(() => {
    const left = (playerPos.x / 100) * MAP_WIDTH - 28;
    const top = (playerPos.y / 100) * MAP_HEIGHT - 54;
    if (!tokenPlaced.current) {
      tokenPlaced.current = true;
      tokenLeft.setValue(left);
      tokenTop.setValue(top);
      return;
    }
    const glide = Animated.parallel([
      Animated.timing(tokenLeft, { toValue: left, duration: 900, useNativeDriver: false }),
      Animated.timing(tokenTop, { toValue: top, duration: 900, useNativeDriver: false }),
    ]);
    glide.start();
    return () => glide.stop();
  }, [playerPos, tokenLeft, tokenTop]);

  // Camera follow: after the token starts gliding to a new spot (quest
  // completed while the map stays mounted), glide the camera to re-center
  // it. First paint is covered by the initial snap in handleMapLayout.
  const mapHeightRef = useRef(0);
  const prevQuestCount = useRef(journeyQuestCount);
  useEffect(() => {
    if (prevQuestCount.current === journeyQuestCount) {
      return;
    }
    prevQuestCount.current = journeyQuestCount;
    if (!hasScrolledInitial || mapHeightRef.current <= 0) {
      return;
    }
    const playerPixelY = (playerPos.y / 100) * mapHeightRef.current;
    const targetY = Math.max(0, playerPixelY - SCREEN_HEIGHT / 2 + 60);
    const t = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
    }, 350);
    return () => clearTimeout(t);
  }, [journeyQuestCount, playerPos.y, hasScrolledInitial]);

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
      mapHeightRef.current = mapActualHeight;
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
        scrollEnabled={!draggingPin}
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
          {SHOW_GLOW_PINS &&
            GLOWING_NODE_INDICES.map((wpIndex, order) => {
              const override = pinOverrides[wpIndex];
              const wp = TRAIL_WAYPOINTS[wpIndex]!;
              const x = override ? override.x : wp.x;
              const y = override ? override.y : wp.y;
              const isReached = journeyQuestCount >= wp.quest;
              if (CALIBRATE_PATH_PINS) {
                return (
                  <CalibratePin
                    key={'wp-' + wpIndex}
                    index={wpIndex}
                    orderNo={order + 1}
                    baseX={x}
                    baseY={y}
                    reached={isReached}
                    onCommit={handleCommitPin}
                    onDragState={handlePinDragState}
                  />
                );
              }
              const px = (x / 100) * MAP_WIDTH;
              const py = (y / 100) * MAP_HEIGHT;
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
                  accessibilityLabel={
                    isCompleted
                      ? t('journeyMap.pinCompleted', { name: chapter.data.name })
                      : isCurrent
                        ? t('journeyMap.pinCurrent', { name: chapter.data.name })
                        : t('journeyMap.pinLocked', { name: chapter.data.name })
                  }
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
                      <Text style={styles.currentIndicatorText}>{t('journeyMap.you')}</Text>
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
                      ? t('journeyMap.completed')
                      : isCurrent
                        ? chapter.data.id === 7 && chapter.fraction >= 1
                          ? t('journeyMap.progressOf', { a: 365, b: 365 })
                          : t('journeyMap.progressOf', {
                              a: chapter.questsInChapter,
                              b: chapter.span ?? chapter.data.threshold,
                            })
                        : t('journeyMap.reachQuests', { n: chapter.data.threshold })}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          {/* Animated Player Map Token — outer glides along the trail (JS
              driver, layout props), inner keeps the native-driver bob. */}
          {showPlayerToken ? (
            <Animated.View
              style={[styles.playerTokenContainer, { left: tokenLeft, top: tokenTop }]}
              pointerEvents="none"
            >
              <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
                {/* Glowing Aura under pedestal */}
                <View style={styles.playerPedestalAura} />
                <Image
                  source={PLAYER_MAP_TOKEN}
                  style={styles.playerTokenImage}
                  contentFit="contain"
                />
              </Animated.View>
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
                  {t('journeyMap.chapterTitle', {
                    id: currentChapter.data.id,
                    name: currentChapter.data.name,
                  })}
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

      {/* Player Token Show/Hide Toggle — eye medallion, dimmed while hidden. */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={showPlayerToken ? t('journeyMap.hideToken') : t('journeyMap.showToken')}
        style={styles.tokenToggle}
        activeOpacity={0.8}
        onPress={withTapCue(() => setShowPlayerToken((visible) => !visible))}
      >
        <Image
          source={TOKEN_EYE_MEDALLION}
          style={[styles.tokenToggleMedallion, showPlayerToken ? null : styles.tokenToggleHidden]}
          contentFit="cover"
        />
      </TouchableOpacity>
      {/* Weekly world quests — 60px circle dock, bottom-right above the eye toggle. */}
      <WorldQuestsTab journeyQuestCount={journeyQuestCount} />
      {CALIBRATE_PATH_PINS ? (
        <View style={styles.calibrateBanner} pointerEvents="none">
          <Text style={styles.calibrateBannerText}>
            Drag the numbered dots into place, then tap Export
          </Text>
        </View>
      ) : null}
      {CALIBRATE_PATH_PINS ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Export pin positions"
          style={styles.calibrateExport}
          activeOpacity={0.8}
          onPress={handleExportPins}
        >
          <Text style={styles.calibrateExportText}>Export</Text>
        </TouchableOpacity>
      ) : null}

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
  calibrateHit: {
    position: 'absolute',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  calibrateTag: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  calibrateTagText: {
    color: '#1A1208',
    fontFamily: fonts.bodyBold.family,
    fontSize: 11,
  },
  calibrateBanner: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(16, 20, 26, 0.92)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FFD700',
    padding: spacing.md,
    alignItems: 'center',
    zIndex: 12,
  },
  calibrateBannerText: {
    color: '#FFD700',
    fontFamily: fonts.bodyBold.family,
    fontSize: 12,
  },
  calibrateExport: {
    position: 'absolute',
    end: spacing.lg,
    bottom: 205,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  calibrateExportText: {
    color: '#1A1208',
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
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
    end: spacing.lg,
    bottom: 150,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(16, 20, 26, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  tokenToggleMedallion: {
    width: 44,
    height: 44,
  },
  tokenToggleHidden: {
    opacity: 0.4,
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

/**
 * CUSTOM-AVATAR — Discord-style circular crop editor (owner call: drag +
 * pinch + zoom slider under a fixed circle mask, like Discord's avatar
 * editor). The native picker crop is square-only, so picking runs with
 * `allowsEditing: false` and framing happens here.
 *
 * No new dependencies, no reanimated (ED-1): one- and two-finger gestures
 * are tracked manually from the responder touch lists, the slider is a
 * plain responder track, and the crop is captured with expo-image-manipulator.
 * Copy reuses existing keys only (no zh-subset risk).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image as RNImage,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { colors, fonts, radius, spacing } from '@/lib/theme';
import { withTapCue } from '@/lib/sounds';

export interface AvatarCropEditorProps {
  visible: boolean;
  /** Full-size picked image (file://). Null while closed. */
  imageUri: string | null;
  onCancel: () => void;
  /** Cropped 1:1 JPEG uri + its base64 (RN-reliable upload bytes). */
  onApply: (croppedUri: string, base64: string | null) => void;
}

interface Pt {
  x: number;
  y: number;
}

interface PinchSnap {
  scale: number;
  tx: number;
  ty: number;
  dist: number;
  mid: Pt;
}

const MAX_SCALE = 3;
// Owner call: the veil outside the ring is a uniform near-black (a light
// dim leaves bright photo areas looking washed-gray and uneven).
const DIM = 'rgba(0, 0, 0, 0.85)';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const distOf = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

const midOf = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function AvatarCropEditor({ visible, imageUri, onCancel, onApply }: AvatarCropEditorProps) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();

  // Square stage + centered circle mask (the Discord ring).
  const stage = windowWidth;
  const diameter = stage - 72;
  const radiusHalf = diameter / 2;
  const center = stage / 2;

  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [trackW, setTrackW] = useState(0);

  const touchesRef = useRef(new Map<number, Pt>());
  const snapRef = useRef<PinchSnap | null>(null);
  const lastSingleRef = useRef<Pt | null>(null);

  // Contain-fit of the source inside the square stage.
  const fit = useMemo(() => {
    if (!imgSize) return null;
    const k = Math.min(stage / imgSize.w, stage / imgSize.h);
    return { k, fitW: imgSize.w * k, fitH: imgSize.h * k };
  }, [imgSize, stage]);
  const minScale = useMemo(() => {
    if (!fit) return 1;
    return Math.max(diameter / fit.fitW, diameter / fit.fitH, 1);
  }, [fit, diameter]);

  // Fresh mount per pick (parent passes key={imageUri}): all state starts
  // clean, so this effect only measures. State sets happen in the async
  // getSize callbacks (allowed — not synchronous effect-body sets).
  useEffect(() => {
    if (!visible || !imageUri) {
      return;
    }
    let cancelled = false;
    RNImage.getSize(
      imageUri,
      (w, h) => {
        if (cancelled || w <= 0 || h <= 0) {
          return;
        }
        const fitK = Math.min(stage / w, stage / h);
        setImgSize({ w, h });
        setScale(Math.max(diameter / (w * fitK), diameter / (h * fitK), 1));
      },
      () => {
        if (!cancelled) {
          setLoadError(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [visible, imageUri, stage, diameter]);

  const clampTx = (v: number, s: number): number => {
    if (!fit) return 0;
    const bound = Math.max(0, (fit.fitW * s) / 2 - radiusHalf);
    return clamp(v, -bound, bound);
  };
  const clampTy = (v: number, s: number): number => {
    if (!fit) return 0;
    const bound = Math.max(0, (fit.fitH * s) / 2 - radiusHalf);
    return clamp(v, -bound, bound);
  };
  const clampScale = (s: number): number => clamp(s, minScale, MAX_SCALE);

  /** Shared one-/two-finger tracking from the raw touch lists. */
  const syncTouches = (e: GestureResponderEvent, isStart: boolean): void => {
    const map = touchesRef.current;
    const list = isStart ? e.nativeEvent.changedTouches : e.nativeEvent.touches;
    for (const touch of list) {
      map.set(Number(touch.identifier), { x: touch.pageX, y: touch.pageY });
    }
    const pts = [...map.values()];
    if (pts.length >= 2) {
      const a = pts[0]!;
      const b = pts[1]!;
      const d = Math.max(1, distOf(a, b));
      const m = midOf(a, b);
      const snap = snapRef.current;
      if (!snap) {
        snapRef.current = { scale, tx, ty, dist: d, mid: m };
      } else {
        const next = clampScale((snap.scale * d) / snap.dist);
        setScale(next);
        setTx(clampTx(snap.tx + (m.x - snap.mid.x), next));
        setTy(clampTy(snap.ty + (m.y - snap.mid.y), next));
      }
      lastSingleRef.current = null;
    } else if (pts.length === 1) {
      snapRef.current = null;
      const p = pts[0]!;
      const last = lastSingleRef.current;
      if (last) {
        setTx(clampTx(tx + (p.x - last.x), scale));
        setTy(clampTy(ty + (p.y - last.y), scale));
      }
      lastSingleRef.current = p;
    }
  };

  const endTouches = (e: GestureResponderEvent): void => {
    const map = touchesRef.current;
    for (const touch of e.nativeEvent.changedTouches) {
      map.delete(Number(touch.identifier));
    }
    if (map.size < 2) {
      snapRef.current = null;
    }
    const remaining = [...map.values()];
    lastSingleRef.current = remaining.length === 1 ? (remaining[0] ?? null) : null;
  };

  const sliderT = minScale >= MAX_SCALE ? 0 : (scale - minScale) / (MAX_SCALE - minScale);
  const setSliderT = (ratio: number): void => {
    const next = minScale + clamp(ratio, 0, 1) * (MAX_SCALE - minScale);
    const clamped = clampScale(next);
    setScale(clamped);
    setTx((current) => clampTx(current, clamped));
    setTy((current) => clampTy(current, clamped));
  };

  const handleApply = async (): Promise<void> => {
    if (!imgSize || !fit || !imageUri || busy) {
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      // Screen px → image px at the current zoom.
      const pxPerImage = 1 / (fit.k * scale);
      const size = Math.max(1, Math.round(diameter * pxPerImage));
      const w = Math.min(size, imgSize.w);
      const h = Math.min(size, imgSize.h);
      const ox = clamp(
        Math.round(imgSize.w / 2 - tx * pxPerImage - w / 2),
        0,
        Math.max(0, imgSize.w - w),
      );
      const oy = clamp(
        Math.round(imgSize.h / 2 - ty * pxPerImage - h / 2),
        0,
        Math.max(0, imgSize.h - h),
      );
      const result = await manipulateAsync(
        imageUri,
        [{ crop: { originX: ox, originY: oy, width: w, height: h } }],
        { compress: 0.85, format: SaveFormat.JPEG, base64: true },
      );
      onApply(result.uri, result.base64 ?? null);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.headerButton}
            onPress={withTapCue(onCancel)}
          >
            <Text style={styles.headerAction}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile.changeAvatarTitle')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.headerButton, styles.headerSave, busy && styles.headerSaveDisabled]}
            disabled={busy || !imgSize}
            onPress={() => void handleApply()}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Text style={styles.headerSaveLabel}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Stage */}
        <View style={[styles.stage, { width: stage, height: stage }]}>
          {!imgSize && !loadError ? (
            <View style={styles.centerFill}>
              <ActivityIndicator size="large" color={colors.reward} />
            </View>
          ) : null}
          {fit && imgSize ? (
            <View
              style={styles.touchArea}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => syncTouches(e, true)}
              onResponderMove={(e) => syncTouches(e, false)}
              onResponderRelease={endTouches}
              onResponderTerminate={endTouches}
            >
              <Image
                source={imageUri ? { uri: imageUri } : null}
                style={{
                  width: fit.fitW,
                  height: fit.fitH,
                  left: (stage - fit.fitW) / 2 + tx,
                  top: (stage - fit.fitH) / 2 + ty,
                  transform: [{ scale }],
                }}
                contentFit="cover"
              />
              {/* Circle mask: 4 dim rects + bright ring (all passthrough).
                  Pieces are absolutely positioned — relative positioning
                  would stack them as a column and throw the ring off. */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View
                  style={[
                    styles.maskPiece,
                    { left: 0, top: 0, width: stage, height: center - radiusHalf },
                  ]}
                />
                <View
                  style={[
                    styles.maskPiece,
                    {
                      left: 0,
                      top: center + radiusHalf,
                      width: stage,
                      height: stage - (center + radiusHalf),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.maskPiece,
                    {
                      left: 0,
                      top: center - radiusHalf,
                      width: center - radiusHalf,
                      height: diameter,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.maskPiece,
                    {
                      left: center + radiusHalf,
                      top: center - radiusHalf,
                      width: stage - (center + radiusHalf),
                      height: diameter,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.maskPiece,
                    styles.maskRing,
                    {
                      left: center - radiusHalf,
                      top: center - radiusHalf,
                      width: diameter,
                      height: diameter,
                      borderRadius: radiusHalf,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>

        {/* Zoom slider (Discord row: small icon — track — large icon). */}
        {fit ? (
          <View style={styles.sliderRow}>
            <Ionicons name="image-outline" size={16} color={colors.textMuted} />
            <View
              style={styles.sliderTrack}
              onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                if (trackW > 0) setSliderT(e.nativeEvent.locationX / trackW);
              }}
              onResponderMove={(e) => {
                if (trackW > 0) setSliderT(e.nativeEvent.locationX / trackW);
              }}
            >
              <View style={styles.sliderRail} />
              <View
                style={[styles.sliderFill, { width: `${Math.round(clamp(sliderT, 0, 1) * 100)}%` }]}
              />
              <View
                style={[
                  styles.sliderKnob,
                  { left: clamp(sliderT, 0, 1) * Math.max(0, trackW - 24) },
                ]}
              />
            </View>
            <Ionicons name="image-outline" size={26} color={colors.text} />
          </View>
        ) : null}

        {loadError || failed ? <Text style={styles.error}>{t('profile.saveFailed')}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // App brown, not pitch black (owner call — matches every other screen).
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  headerButton: {
    minWidth: 72,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerAction: {
    color: colors.text,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fonts.display.family,
    fontSize: 18,
  },
  headerSave: {
    alignItems: 'center',
    backgroundColor: colors.reward,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  headerSaveDisabled: {
    opacity: 0.5,
  },
  headerSaveLabel: {
    color: colors.background,
    fontFamily: fonts.bodyBold.family,
    fontSize: 15,
  },
  stage: {
    backgroundColor: colors.background,
    // A dragged/zoomed photo must never paint outside the square stage —
    // without this it slides over the header and eats Cancel/Save taps.
    overflow: 'hidden',
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchArea: {
    flex: 1,
  },
  maskPiece: {
    position: 'absolute',
    backgroundColor: DIM,
  },
  maskRing: {
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  sliderTrack: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  sliderRail: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceElevated,
  },
  sliderFill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.reward,
  },
  sliderKnob: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.body.family,
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: spacing.lg,
  },
});

/**
 * S6-01 — victory SFX via expo-audio (SDK 57's audio module; expo-av is not
 * part of SDK 57). Two CC0 Kenney chimes, bundled as assets. Every call site
 * funnels through playOnce so a missing/corrupt asset or a player error can
 * never crash the celebration.
 */
import { useAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

const VICTORY_TRACK = require('../../../assets/sounds/victory.wav') as number;
const LEVEL_UP_TRACK = require('../../../assets/sounds/levelup.wav') as number;

export interface VictorySounds {
  victory: AudioPlayer;
  levelUp: AudioPlayer;
}

export function useVictorySounds(): VictorySounds {
  const victory = useAudioPlayer(VICTORY_TRACK);
  const levelUp = useAudioPlayer(LEVEL_UP_TRACK);
  return { victory, levelUp };
}

/** Replay the chime from the start; swallow any audio failure. */
export function playOnce(player: AudioPlayer | null | undefined): void {
  if (!player) {
    return;
  }
  try {
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // Audio must never block the victory moment.
  }
}

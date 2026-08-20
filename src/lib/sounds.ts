/**
 * AT-01D / AT-01K / AT-01M / AT-02C — shared sound-cue player (9 cues).
 *
 * Cues: click, countdown, exercise_end, rest_start, rest_end, quest_complete,
 * levelup, victory_fanfare, chapter_unlocked. Lazy pooled players with
 * unconditional fire-and-forget `seekTo(0)` + `play()` — the known-good
 * pattern that produced audible sound on this emulator before the AT-01J/
 * AT-01L experiments. Every call is wrapped so a missing/corrupt asset or a
 * player error can never crash a screen (same contract as the original
 * victory chimes). `withTapCue` is the shared helper for button taps.
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

export type SoundCue =
  | 'click'
  | 'countdown'
  | 'exerciseEnd'
  | 'restStart'
  | 'restEnd'
  | 'questComplete'
  | 'levelup'
  | 'victoryFanfare'
  | 'chapterUnlocked';

const SOURCES: Record<SoundCue, number> = {
  click: require('@/assets/sounds/click.wav') as number,
  countdown: require('@/assets/sounds/countdown.wav') as number,
  exerciseEnd: require('@/assets/sounds/exercise_end.wav') as number,
  restStart: require('@/assets/sounds/rest_start.wav') as number,
  restEnd: require('@/assets/sounds/rest_end.wav') as number,
  questComplete: require('@/assets/sounds/quest_complete.wav') as number,
  levelup: require('@/assets/sounds/levelup.wav') as number,
  victoryFanfare: require('@/assets/sounds/victory_fanfare.wav') as number,
  chapterUnlocked: require('@/assets/sounds/chapter_unlocked.wav') as number,
};

const players = new Map<SoundCue, AudioPlayer>();

function playerFor(cue: SoundCue): AudioPlayer | null {
  try {
    let player = players.get(cue);
    if (!player) {
      player = createAudioPlayer(SOURCES[cue]);
      players.set(cue, player);
    }
    return player;
  } catch {
    return null;
  }
}

/** Replay the cue from the start; swallow any audio failure. */
export function playCue(cue: SoundCue): void {
  const player = playerFor(cue);
  if (!player) {
    return;
  }
  try {
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // audio must never block the UI
  }
}

/** Shared tap-cue helper: plays the click cue, then runs the handler. */
export function withTapCue(handler: () => void): () => void {
  return () => {
    playCue('click');
    handler();
  };
}

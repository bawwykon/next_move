/**
 * AT-01D — shared sound-cue player (8 cues, final sound set).
 *
 * Cues: click, countdown, exercise_end, rest_start, rest_end, quest_complete,
 * levelup, victory_fanfare. Players are created eagerly at module load (each
 * WAV is tiny, 0.6–4 s) so the first cue never races native load; replays
 * seek through the public `seekTo` API. Every call is wrapped so a
 * missing/corrupt asset or a player error can never crash a screen (same
 * contract as the original victory chimes).
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
  | 'victoryFanfare';

const SOURCES: Record<SoundCue, number> = {
  click: require('@/assets/sounds/click.wav') as number,
  countdown: require('@/assets/sounds/countdown.wav') as number,
  exerciseEnd: require('@/assets/sounds/exercise_end.wav') as number,
  restStart: require('@/assets/sounds/rest_start.wav') as number,
  restEnd: require('@/assets/sounds/rest_end.wav') as number,
  questComplete: require('@/assets/sounds/quest_complete.wav') as number,
  levelup: require('@/assets/sounds/levelup.wav') as number,
  victoryFanfare: require('@/assets/sounds/victory_fanfare.wav') as number,
};

const players = new Map<SoundCue, AudioPlayer>();

// Eager creation at module load — each WAV is tiny (0.6–4 s), and a player
// created on the first cue races the native load (silent first cue).
for (const cue of Object.keys(SOURCES) as SoundCue[]) {
  try {
    players.set(cue, createAudioPlayer(SOURCES[cue]));
  } catch {
    // audio must never break a screen
  }
}

/** Replay the cue from the start; swallow any audio failure. */
export function playCue(cue: SoundCue): void {
  const player = players.get(cue);
  if (!player) {
    return;
  }
  try {
    if (player.isLoaded) {
      player.seekTo(0).catch(() => undefined);
    }
    player.play();
  } catch {
    // Audio must never block the UI.
  }
}

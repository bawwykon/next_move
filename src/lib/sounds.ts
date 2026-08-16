/**
 * AT-01D / AT-01K / AT-01L — shared sound-cue player (7 cues, final sound
 * set).
 *
 * Cues: countdown, exercise_end, rest_start, rest_end, quest_complete,
 * levelup, victory_fanfare (the click cue was retired in AT-01K). A fresh
 * player is created per cue and released when its WAV finishes — a newly
 * created player reliably starts (observed: the session's first cue always
 * played), and releasing it frees the audio session for the next cue. Every
 * call is wrapped so a missing/corrupt asset or a player error can never
 * crash a screen (same contract as the original victory chimes).
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

export type SoundCue =
  | 'countdown'
  | 'exerciseEnd'
  | 'restStart'
  | 'restEnd'
  | 'questComplete'
  | 'levelup'
  | 'victoryFanfare';

const SOURCES: Record<SoundCue, number> = {
  countdown: require('@/assets/sounds/countdown.wav') as number,
  exerciseEnd: require('@/assets/sounds/exercise_end.wav') as number,
  restStart: require('@/assets/sounds/rest_start.wav') as number,
  restEnd: require('@/assets/sounds/rest_end.wav') as number,
  questComplete: require('@/assets/sounds/quest_complete.wav') as number,
  levelup: require('@/assets/sounds/levelup.wav') as number,
  victoryFanfare: require('@/assets/sounds/victory_fanfare.wav') as number,
};

// Standard session config — plays even in silent mode; set once at load.
void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);

/** Play a cue from the start on a fresh player; swallow any audio failure. */
export function playCue(cue: SoundCue): void {
  try {
    // Fresh player per cue: a newly created player reliably starts (observed:
    // the session's first cue always played), and releasing it when the WAV
    // finishes frees the audio session for the next cue.
    const player = createAudioPlayer(SOURCES[cue]);
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        player.release();
      }
    });
    player.play();
  } catch {
    // Audio must never block the UI.
  }
}

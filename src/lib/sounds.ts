/**
 * AT-01D / AT-01K / AT-01M / AT-02C / SOUND-EFFECTS-UPGRADE — shared sound-cue
 * player (12 cues).
 *
 * Cues: click, countdown, exercise_end, rest_start, rest_end, quest_complete,
 * levelup, victory_fanfare, chapter_unlocked, achievement_unlocked,
 * mastery_levelup, world_quest_complete. Lazy pooled players with
 * unconditional fire-and-forget `seekTo(0)` + `play()` — the known-good
 * pattern that produced audible sound on this emulator before the AT-01J/
 * AT-01L experiments. Every call is wrapped so a missing/corrupt asset or a
 * player error can never crash a screen (same contract as the original
 * victory chimes). `withTapCue` plays `click` only on the approved whitelist:
 * Build Your Quest, quest selection, Continue/Next, Back, Settings toggles,
 * Tabs, Profile loadout selections, Achievement selection, Journey
 * chapter/map buttons, World Quest button, World Quest reroll, Claim reward,
 * Show/hide character.
 *
 * Background-music coexistence (industry pattern: Sweat/Sworkit/Strava keep
 * the user's music playing and layer cues over it):
 * - click (UI taps): pure mix, no focus change — taps never disturb music.
 * - workout/victory cues: transient duck — music dips under the cue, then
 *   restores. CUE_DURATIONS_MS mirrors assets/sounds/*.wav lengths.
 * The Sound FX settings toggle gates everything via setSoundFxEnabled
 * (init once at startup, updated on toggle).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SoundCue =
  | 'click'
  | 'countdown'
  | 'exerciseEnd'
  | 'restStart'
  | 'restEnd'
  | 'questComplete'
  | 'levelup'
  | 'victoryFanfare'
  | 'chapterUnlocked'
  | 'achievementUnlocked'
  | 'masteryLevelup'
  | 'worldQuestComplete';

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
  achievementUnlocked: require('@/assets/sounds/achievement_unlocked.wav') as number,
  masteryLevelup: require('@/assets/sounds/mastery_levelup.wav') as number,
  worldQuestComplete: require('@/assets/sounds/world_quest_complete.wav') as number,
};

const players = new Map<SoundCue, AudioPlayer>();

/** Playback lengths of assets/sounds/*.wav — duck windows are duration + buffer. */
const CUE_DURATIONS_MS: Record<Exclude<SoundCue, 'click'>, number> = {
  countdown: 4350,
  exerciseEnd: 700,
  restStart: 700,
  restEnd: 700,
  questComplete: 2200,
  levelup: 1900,
  victoryFanfare: 3000,
  chapterUnlocked: 3500,
  achievementUnlocked: 4000,
  masteryLevelup: 2700,
  worldQuestComplete: 2200,
};
const DUCK_RELEASE_BUFFER_MS = 400;

/** Rapid-fire guard: taps faster than this reuse the in-flight cue instead of
 *  stacking seek+play storms on the shared player (builder add-taps). */
const CLICK_THROTTLE_MS = 100;
let lastClickAt = 0;

/** Sound FX master switch (Settings). Defaults on; synced at startup + toggle. */
let soundFxEnabled = true;
export function setSoundFxEnabled(value: boolean): void {
  soundFxEnabled = value;
}

/** Duck music under a cue, restoring mix afterwards (re-armed by overlaps). */
let duckReleaseTimer: ReturnType<typeof setTimeout> | null = null;
function duckForCue(durationMs: number): void {
  try {
    void setAudioModeAsync({ interruptionMode: 'duckOthers' }).catch(() => undefined);
  } catch {
    // audio must never block the UI
  }
  if (duckReleaseTimer !== null) {
    clearTimeout(duckReleaseTimer);
  }
  duckReleaseTimer = setTimeout(() => {
    duckReleaseTimer = null;
    try {
      void setAudioModeAsync({ interruptionMode: 'mixWithOthers' }).catch(() => undefined);
    } catch {
      // audio must never block the UI
    }
  }, durationMs + DUCK_RELEASE_BUFFER_MS);
}

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
  if (!soundFxEnabled) {
    return;
  }
  if (cue === 'click') {
    const now = Date.now();
    if (now - lastClickAt < CLICK_THROTTLE_MS) {
      return;
    }
    lastClickAt = now;
  } else {
    duckForCue(CUE_DURATIONS_MS[cue]);
  }
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

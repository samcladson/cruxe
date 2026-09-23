/**
 * soundService.ts — Lightweight audio feedback for Cruxe.
 *
 * Uses expo-audio to play short sound effects at key gameplay moments.
 * Respects the user's soundEnabled setting from settingsStore.
 *
 * The files are Google's Material Design sounds (CC BY 4.0, credited in the
 * Terms), trimmed and levelled by scripts/audio/master-sfx.cjs. Relative
 * levels are set there, per role, so every player here runs at full volume.
 *
 * Sounds are preloaded on first use and cached for instant playback.
 * All methods are fire-and-forget — audio errors never block gameplay.
 */

import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useSettingsStore } from "../stores/settingsStore";

// ─── Sound definitions ───────────────────────────────────────────────

const SOUND_FILES = {
  cellTap: require("../assets/sounds/cell-tap.wav"),
  letterInput1: require("../assets/sounds/letter-input-1.wav"),
  letterInput2: require("../assets/sounds/letter-input-2.wav"),
  letterInput3: require("../assets/sounds/letter-input-3.wav"),
  buttonTap: require("../assets/sounds/button-tap.wav"),
  wordComplete: require("../assets/sounds/word-complete.m4a"),
  puzzleComplete: require("../assets/sounds/puzzle-complete.m4a"),
  streak: require("../assets/sounds/streak.m4a"),
  error: require("../assets/sounds/error.m4a"),
  hint: require("../assets/sounds/hint.m4a"),
  coinEarned: require("../assets/sounds/coin-earned.m4a"),
} as const;

type SoundName = keyof typeof SOUND_FILES;

// ─── Preloaded sound cache ───────────────────────────────────────────

const soundCache = new Map<SoundName, AudioPlayer>();
let audioConfigured = false;

/**
 * Configure audio session for game sounds — silent mode compatible,
 * doesn't interrupt music playback.
 */
async function ensureAudioConfigured(): Promise<void> {
  if (audioConfigured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: "duckOthers",
      shouldPlayInBackground: false,
    });
    audioConfigured = true;
  } catch {
    // Non-critical — sounds just won't play
  }
}

/**
 * Loads a sound into cache if not already loaded.
 */
async function loadSound(name: SoundName): Promise<AudioPlayer | null> {
  const existing = soundCache.get(name);
  if (existing) return existing;

  try {
    await ensureAudioConfigured();
    const player = createAudioPlayer(SOUND_FILES[name]);
    player.volume = 1;
    soundCache.set(name, player);
    return player;
  } catch {
    return null;
  }
}

/**
 * Plays a named sound effect. Fire-and-forget — never throws.
 * Respects the soundEnabled setting.
 */
export async function playSound(name: SoundName): Promise<void> {
  if (!useSettingsStore.getState().soundEnabled) return;

  try {
    const sound = await loadSound(name);
    if (!sound) return;

    // Rewind to start in case it was played before
    await sound.seekTo(0);
    sound.play();
  } catch {
    // Silently fail — audio should never crash the app
  }
}

/**
 * Preloads all sounds into memory. Call during app init for instant playback.
 */
export async function preloadSounds(): Promise<void> {
  const names = Object.keys(SOUND_FILES) as SoundName[];
  await Promise.allSettled(names.map((name) => loadSound(name)));
}

// ─── Convenience wrappers ────────────────────────────────────────────

/**
 * Typing cycles through three takes of the same key. One sample fired for
 * every letter is the "machine gun" that makes game audio sound cheap, and
 * separate players also let a fast typist's letters overlap instead of each
 * one cutting off the last.
 */
const LETTER_TAKES = ["letterInput1", "letterInput2", "letterInput3"] as const;
let nextLetterTake = 0;

export const SFX = {
  cellTap: () => playSound("cellTap"),
  letterInput: () => {
    const take = LETTER_TAKES[nextLetterTake];
    nextLetterTake = (nextLetterTake + 1) % LETTER_TAKES.length;
    return playSound(take);
  },
  buttonTap: () => playSound("buttonTap"),
  puzzleComplete: () => playSound("puzzleComplete"),
  streak: () => playSound("streak"),
  hint: () => playSound("hint"),
  coinEarned: () => playSound("coinEarned"),
  /** After a check: a chime when it found nothing, the error tone if not. */
  checkResult: (outcome: "clean" | "errors") =>
    playSound(outcome === "clean" ? "wordComplete" : "error"),
};

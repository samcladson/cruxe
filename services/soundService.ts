/**
 * soundService.ts — Lightweight audio feedback for Cruxe.
 *
 * Uses expo-av to play short sound effects at key gameplay moments.
 * Respects the user's soundEnabled setting from settingsStore.
 *
 * Sounds are preloaded on first use and cached for instant playback.
 * All methods are fire-and-forget — audio errors never block gameplay.
 */

import { Audio } from "expo-av";
import { useSettingsStore } from "../stores/settingsStore";

// ─── Sound definitions ───────────────────────────────────────────────

const SOUND_FILES = {
  cellTap: require("../assets/sounds/cell-tap.mp3"),
  letterInput: require("../assets/sounds/letter-input.mp3"),
  wordComplete: require("../assets/sounds/word-complete.mp3"),
  puzzleComplete: require("../assets/sounds/puzzle-complete.mp3"),
  error: require("../assets/sounds/error.mp3"),
  hint: require("../assets/sounds/hint.mp3"),
  coinEarned: require("../assets/sounds/coin-earned.mp3"),
} as const;

type SoundName = keyof typeof SOUND_FILES;

// ─── Preloaded sound cache ───────────────────────────────────────────

const soundCache = new Map<SoundName, Audio.Sound>();
let audioConfigured = false;

/**
 * Configure audio session for game sounds — silent mode compatible,
 * doesn't interrupt music playback.
 */
async function ensureAudioConfigured(): Promise<void> {
  if (audioConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });
    audioConfigured = true;
  } catch {
    // Non-critical — sounds just won't play
  }
}

/**
 * Loads a sound into cache if not already loaded.
 */
async function loadSound(name: SoundName): Promise<Audio.Sound | null> {
  const existing = soundCache.get(name);
  if (existing) return existing;

  try {
    await ensureAudioConfigured();
    const { sound } = await Audio.Sound.createAsync(SOUND_FILES[name], {
      shouldPlay: false,
      volume: 0.6,
    });
    soundCache.set(name, sound);
    return sound;
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
    await sound.setPositionAsync(0);
    await sound.playAsync();
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

/**
 * Unloads all cached sounds. Call on app teardown to free memory.
 */
export async function unloadSounds(): Promise<void> {
  for (const [, sound] of soundCache) {
    try {
      await sound.unloadAsync();
    } catch {
      // ignore
    }
  }
  soundCache.clear();
}

// ─── Convenience wrappers ────────────────────────────────────────────

export const SFX = {
  cellTap: () => playSound("cellTap"),
  letterInput: () => playSound("letterInput"),
  wordComplete: () => playSound("wordComplete"),
  puzzleComplete: () => playSound("puzzleComplete"),
  error: () => playSound("error"),
  hint: () => playSound("hint"),
  coinEarned: () => playSound("coinEarned"),
};

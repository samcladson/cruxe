/**
 * The audio session mode soundService configures.
 *
 * The bug this covers: every sound was silent on iOS. The mode asked for
 * `playsInSilentMode: false` together with `duckOthers`, and expo-audio's iOS
 * validation rejects that pair outright. The rejection was swallowed, so the
 * session was never configured and nothing played. Even with a valid pair,
 * `playsInSilentMode: false` puts iOS on the ambient category, which the
 * ringer switch mutes.
 */

const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-audio", () => ({
  setAudioModeAsync: (...args: unknown[]) => setAudioModeAsync(...args),
  createAudioPlayer: jest.fn(() => ({
    volume: 1,
    seekTo: jest.fn().mockResolvedValue(undefined),
    play: jest.fn(),
  })),
}));

jest.mock("../stores/settingsStore", () => ({
  useSettingsStore: { getState: () => ({ soundEnabled: true }) },
}));

jest.mock("../assets/sounds/button-tap.wav", () => 1, { virtual: true });
jest.mock("../assets/sounds/word-complete.m4a", () => 2, { virtual: true });
jest.mock("../assets/sounds/puzzle-complete.m4a", () => 3, { virtual: true });
jest.mock("../assets/sounds/streak.m4a", () => 4, { virtual: true });
jest.mock("../assets/sounds/error.m4a", () => 5, { virtual: true });
jest.mock("../assets/sounds/hint.m4a", () => 6, { virtual: true });
jest.mock("../assets/sounds/coin-earned.m4a", () => 7, { virtual: true });

import { playSound } from "../services/soundService";

describe("soundService audio mode", () => {
  it("plays through the iOS silent switch", async () => {
    await playSound("buttonTap");
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync.mock.calls[0][0].playsInSilentMode).toBe(true);
  });

  it("never pairs playsInSilentMode:false with duckOthers, which iOS rejects", async () => {
    await playSound("buttonTap");
    const mode = setAudioModeAsync.mock.calls[0][0];
    const iosRejects =
      !mode.playsInSilentMode &&
      (mode.interruptionMode === "duckOthers" || mode.shouldPlayInBackground);
    expect(iosRejects).toBe(false);
  });
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  theme: "dark" | "light" | "system";
  /**
   * false until the user finishes the first run (welcome + tutorial).
   * Set once at the end, whether they solved the tutorial or skipped it —
   * skipping is a choice, and re-prompting would be nagging.
   */
  hasCompletedOnboarding: boolean;
  /**
   * Cruxe has clues that read right-to-left and bottom-to-top, which is not
   * how crosswords normally work. This gates a one-time explanation, fired
   * the first time a reverse clue is selected — in the tutorial or in a real
   * puzzle, whichever comes first.
   */
  hasSeenReverseHint: boolean;
  setHaptics: (enabled: boolean) => void;
  setSound: (enabled: boolean) => void;
  setTheme: (theme: "dark" | "light" | "system") => void;
  setHasCompletedOnboarding: (done: boolean) => void;
  setHasSeenReverseHint: (seen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      soundEnabled: true,
      // Dark-only for now. The palette in constants/theme.ts has no light
      // variant, and app.json declares "dark" to match - a light option here
      // would be a setting that visibly does nothing.
      theme: "dark",
      hasCompletedOnboarding: false,
      hasSeenReverseHint: false,
      setHaptics: (enabled) => set({ hapticsEnabled: enabled }),
      setSound: (enabled) => set({ soundEnabled: enabled }),
      setTheme: (theme) => set({ theme }),
      setHasCompletedOnboarding: (done) => set({ hasCompletedOnboarding: done }),
      setHasSeenReverseHint: (seen) => set({ hasSeenReverseHint: seen }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * When `hasCompletedOnboarding` is missing from storage (upgrades from
       * before this field existed), default to `true` so existing users are not
       * forced through onboarding again.
       */
      merge: (persistedState, currentState) => {
        const p =
          persistedState &&
          typeof persistedState === "object" &&
          persistedState !== null
            ? (persistedState as Partial<SettingsState>)
            : {};
        const hadPriorSettings =
          persistedState != null &&
          typeof persistedState === "object" &&
          Object.keys(persistedState as object).length > 0;
        const hasCompletedOnboarding =
          typeof p.hasCompletedOnboarding === "boolean"
            ? p.hasCompletedOnboarding
            : hadPriorSettings
              ? true
              : false;
        return {
          ...currentState,
          ...p,
          hasCompletedOnboarding,
        };
      },
    },
  ),
);

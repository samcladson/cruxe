import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  theme: "dark" | "light" | "system";
  /** false until the user finishes the onboarding flow (new installs). */
  hasCompletedOnboarding: boolean;
  setHaptics: (enabled: boolean) => void;
  setSound: (enabled: boolean) => void;
  setTheme: (theme: "dark" | "light" | "system") => void;
  setHasCompletedOnboarding: (done: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      soundEnabled: true,
      theme: "dark", // Obsidian UI defaults to dark
      hasCompletedOnboarding: false,
      setHaptics: (enabled) => set({ hapticsEnabled: enabled }),
      setSound: (enabled) => set({ soundEnabled: enabled }),
      setTheme: (theme) => set({ theme }),
      setHasCompletedOnboarding: (done) => set({ hasCompletedOnboarding: done }),
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

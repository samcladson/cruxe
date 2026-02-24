import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  theme: "dark" | "light" | "system";
  setHaptics: (enabled: boolean) => void;
  setSound: (enabled: boolean) => void;
  setTheme: (theme: "dark" | "light" | "system") => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      soundEnabled: true,
      theme: "dark", // Obsidian UI defaults to dark
      setHaptics: (enabled) => set({ hapticsEnabled: enabled }),
      setSound: (enabled) => set({ soundEnabled: enabled }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

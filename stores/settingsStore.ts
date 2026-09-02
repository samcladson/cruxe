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
  /** Daily "new puzzles" reminder. Off until the user turns it on — we never
   *  ask for notification permission before they have asked for a reminder. */
  dailyReminderEnabled: boolean;
  /** Local hour (0-23) for the daily reminder. */
  dailyReminderHour: number;
  /** Warn in the evening when an unplayed day would break the streak. */
  streakWarningEnabled: boolean;
  setHaptics: (enabled: boolean) => void;
  setSound: (enabled: boolean) => void;
  setTheme: (theme: "dark" | "light" | "system") => void;
  setHasCompletedOnboarding: (done: boolean) => void;
  setHasSeenReverseHint: (seen: boolean) => void;
  setDailyReminder: (enabled: boolean, hour?: number) => void;
  setStreakWarning: (enabled: boolean) => void;
  /**
   * Returns the app to its first-run state after account deletion.
   *
   * Deliberately does NOT touch sound, haptics or theme: those are device
   * preferences the person set for themselves, not account data, and
   * silently undoing them would be surprising.
   */
  resetFirstRun: () => void;
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
      dailyReminderEnabled: false,
      dailyReminderHour: 19,
      streakWarningEnabled: false,
      setHaptics: (enabled) => set({ hapticsEnabled: enabled }),
      setSound: (enabled) => set({ soundEnabled: enabled }),
      setTheme: (theme) => set({ theme }),
      setHasCompletedOnboarding: (done) => set({ hasCompletedOnboarding: done }),
      setHasSeenReverseHint: (seen) => set({ hasSeenReverseHint: seen }),
      setDailyReminder: (enabled, hour) =>
        set((st) => ({
          dailyReminderEnabled: enabled,
          dailyReminderHour: hour ?? st.dailyReminderHour,
        })),
      setStreakWarning: (enabled) => set({ streakWarningEnabled: enabled }),
      resetFirstRun: () =>
        set({
          hasCompletedOnboarding: false,
          hasSeenReverseHint: false,
          // Reminders belonged to the deleted account. Leaving a toggle on
          // while its notifications are cancelled would be a lie.
          dailyReminderEnabled: false,
          streakWarningEnabled: false,
        }),
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

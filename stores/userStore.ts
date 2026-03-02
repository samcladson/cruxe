import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Category } from "../types/puzzle.types";
import { CategoryStat, UserProfile } from "../types/user.types";

interface UserState {
  profile: UserProfile;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  incrementStreak: () => void;
  completePuzzle: (
    category: Category,
    timeTaken: number,
    correctWords: number,
    totalWords: number,
    score: number,
  ) => void;
}

const initialCategoryStats: Record<Category, CategoryStat> = {
  general: { solved: 0, averageTime: 0, bestTime: Infinity, accuracy: 0 },
  history: { solved: 0, averageTime: 0, bestTime: Infinity, accuracy: 0 },
  technology: { solved: 0, averageTime: 0, bestTime: Infinity, accuracy: 0 },
  entertainment: { solved: 0, averageTime: 0, bestTime: Infinity, accuracy: 0 },
  sports: { solved: 0, averageTime: 0, bestTime: Infinity, accuracy: 0 },
};

const initialProfile: UserProfile = {
  id: "guest",
  displayName: "Player",
  avatarUrl: "",
  coins: 50, // Starting coins
  totalScore: 0,
  totalPuzzlesSolved: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastPlayedDate: new Date().toISOString(),
  categoryStats: initialCategoryStats,
  achievements: [],
  rank: 1,
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: initialProfile,

      addCoins: (amount: number) =>
        set((state) => ({
          profile: { ...state.profile, coins: state.profile.coins + amount },
        })),

      spendCoins: (amount: number) => {
        const { profile } = get();
        if (profile.coins >= amount) {
          set((state) => ({
            profile: { ...state.profile, coins: state.profile.coins - amount },
          }));
          return true;
        }
        return false;
      },

      incrementStreak: () => {
        const todayStr = new Date().toISOString().split("T")[0];
        set((state) => {
          const lastPlayedStr = new Date(state.profile.lastPlayedDate)
            .toISOString()
            .split("T")[0];

          if (lastPlayedStr === todayStr) {
            return state; // Already played today
          }

          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split("T")[0];

          let newStreak =
            lastPlayedStr === yesterdayStr
              ? state.profile.currentStreak + 1
              : 1;

          return {
            profile: {
              ...state.profile,
              currentStreak: newStreak,
              longestStreak: Math.max(state.profile.longestStreak, newStreak),
              lastPlayedDate: new Date().toISOString(),
            },
          };
        });
      },

      completePuzzle: (
        category,
        timeTaken,
        correctWords,
        totalWords,
        score,
      ) => {
        set((state) => {
          const stats = state.profile.categoryStats?.[category] || {
            solved: 0,
            averageTime: 0,
            bestTime: Infinity,
            accuracy: 0,
          };
          const newSolved = stats.solved + 1;
          const newAverageTime =
            (stats.averageTime * stats.solved + timeTaken) / newSolved;
          const newBestTime = Math.min(stats.bestTime, timeTaken);
          const newAccuracy =
            (stats.accuracy * stats.solved + correctWords / totalWords) /
            newSolved;

          return {
            profile: {
              ...state.profile,
              totalScore: (state.profile.totalScore || 0) + score,
              totalPuzzlesSolved: state.profile.totalPuzzlesSolved + 1,
              categoryStats: {
                ...state.profile.categoryStats,
                [category]: {
                  solved: newSolved,
                  averageTime: newAverageTime,
                  bestTime: newBestTime,
                  accuracy: newAccuracy,
                },
              },
            },
          };
        });
      },
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

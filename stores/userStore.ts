/**
 * userStore.ts — Zustand store for the current user's profile and stats.
 *
 * Local state is the source of truth for real-time UI updates (optimistic).
 * Supabase is the authoritative source for long-term persistence.
 *
 * Sync strategy:
 *  - On app launch: hydrate from Supabase (takes precedence over local cache)
 *  - On puzzle completion: write optimistically to local, then sync to Supabase
 *  - Failed syncs are queued and retried on next app launch / network restore
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../services/supabaseClient";
import { Category } from "../types/puzzle.types";
import { CategoryStat, UserProfile } from "../types/user.types";

// ─── Types ────────────────────────────────────────────────────────────

/** A pending puzzle completion that failed to sync to Supabase while offline */
export interface PendingCompletion {
  puzzleId: string;
  userId: string;
  score: number;
  timeTaken: number;
  accuracy: number;
  hintsUsed: number;
  coinsEarned: number;
  puzzleDate: string;
  category: string;
  difficulty: string;
  gridSize: number;
  queuedAt: string; // ISO timestamp
}

interface UserState {
  profile: UserProfile;
  /** Completions that failed to write to Supabase (offline scenarios) */
  pendingCompletions: PendingCompletion[];

  // ─ Profile actions ──────────────────────────────────────────────
  /** Sets the authenticated user's UUID — called after auth init */
  setUserId: (id: string) => void;
  /** Updates the display name (used when user customises their profile) */
  setDisplayName: (name: string) => void;
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

  // ─ Offline queue ────────────────────────────────────────────────
  /** Adds a failed completion to the pending queue for retry */
  enqueuePendingCompletion: (completion: PendingCompletion) => void;
  /** Removes a completion from the queue after successful sync */
  dequeuePendingCompletion: (puzzleId: string) => void;

  // ─ Supabase sync ────────────────────────────────────────────────
  /**
   * Fetches the user's profile from Supabase and hydrates the local store.
   * Supabase wins over local cache on conflict — call on every app launch.
   */
  syncFromSupabase: (userId: string) => Promise<void>;
  /**
   * Writes the current local profile to Supabase.
   * Called after every puzzle completion and after profile edits.
   */
  syncToSupabase: () => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────

/**
 * Sentinel value for "no best time recorded yet."
 * Using Number.MAX_SAFE_INTEGER instead of Infinity because
 * Infinity serialises to null in JSON (breaking AsyncStorage restores).
 */
export const NO_BEST_TIME = Number.MAX_SAFE_INTEGER;

const initialCategoryStats: Record<Category, CategoryStat> = {
  general: { solved: 0, averageTime: 0, bestTime: NO_BEST_TIME, accuracy: 0 },
  history: { solved: 0, averageTime: 0, bestTime: NO_BEST_TIME, accuracy: 0 },
  technology: {
    solved: 0,
    averageTime: 0,
    bestTime: NO_BEST_TIME,
    accuracy: 0,
  },
  entertainment: {
    solved: 0,
    averageTime: 0,
    bestTime: NO_BEST_TIME,
    accuracy: 0,
  },
  sports: { solved: 0, averageTime: 0, bestTime: NO_BEST_TIME, accuracy: 0 },
};

const initialProfile: UserProfile = {
  id: "guest", // Replaced with real UUID after auth init
  displayName: "Player",
  avatarUrl: "",
  coins: 50,
  totalScore: 0,
  totalPuzzlesSolved: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastPlayedDate: new Date().toISOString(),
  categoryStats: initialCategoryStats,
  achievements: [],
  rank: 0,
};

// ─── Store ────────────────────────────────────────────────────────────

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: initialProfile,
      pendingCompletions: [],

      // ── Profile actions ─────────────────────────────────────────
      setUserId: (id: string) =>
        set((state) => ({
          profile: { ...state.profile, id },
        })),

      setDisplayName: (name: string) =>
        set((state) => ({
          profile: { ...state.profile, displayName: name },
        })),

      addCoins: (amount: number) =>
        set((state) => ({
          profile: { ...state.profile, coins: state.profile.coins + amount },
        })),

      spendCoins: (amount: number) => {
        const { profile } = get();
        if (profile.coins >= amount) {
          set((state) => ({
            profile: {
              ...state.profile,
              coins: state.profile.coins - amount,
            },
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
            return state; // Already played today — don't double-increment
          }

          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split("T")[0];

          // Streak continues if played yesterday, resets to 1 otherwise
          const newStreak =
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
          const existing = state.profile.categoryStats?.[category] || {
            solved: 0,
            averageTime: 0,
            bestTime: NO_BEST_TIME,
            accuracy: 0,
          };

          const newSolved = existing.solved + 1;
          // Weighted rolling average for time
          const newAvgTime =
            (existing.averageTime * existing.solved + timeTaken) / newSolved;
          // Use NO_BEST_TIME as the safe sentinel (not Infinity)
          const newBestTime = Math.min(existing.bestTime, timeTaken);
          // Weighted rolling accuracy
          const newAccuracy =
            (existing.accuracy * existing.solved +
              correctWords / Math.max(1, totalWords)) /
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
                  averageTime: newAvgTime,
                  bestTime: newBestTime,
                  accuracy: newAccuracy,
                },
              },
            },
          };
        });
      },

      // ── Offline queue ───────────────────────────────────────────
      enqueuePendingCompletion: (completion: PendingCompletion) => {
        set((state) => ({
          pendingCompletions: [
            ...state.pendingCompletions,
            { ...completion, queuedAt: new Date().toISOString() },
          ],
        }));
      },

      dequeuePendingCompletion: (puzzleId: string) => {
        set((state) => ({
          pendingCompletions: state.pendingCompletions.filter(
            (c) => c.puzzleId !== puzzleId,
          ),
        }));
      },

      // ── Supabase sync ────────────────────────────────────────────
      syncFromSupabase: async (userId: string) => {
        if (!userId || userId === "guest") return;

        try {
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

          if (error) {
            console.warn("[UserStore] syncFromSupabase failed:", error.message);
            return;
          }

          if (!data) {
            // Row doesn't exist yet — local state is the truth, nothing to hydrate
            console.log(
              "[UserStore] No remote profile found, keeping local state",
            );
            return;
          }

          // Merge remote data into local — Supabase wins on core stats,
          // but preserve local category_stats if remote is empty
          const remoteStats = data.category_stats || {};
          const localStats = get().profile.categoryStats;

          // Restore serialised bestTime: null in JSON (was Infinity) → NO_BEST_TIME
          const sanitisedStats: Record<Category, CategoryStat> = {} as any;
          const categories: Category[] = [
            "general",
            "history",
            "technology",
            "entertainment",
            "sports",
          ];
          for (const cat of categories) {
            const remote = remoteStats[cat];
            const local = localStats[cat];
            sanitisedStats[cat] = remote
              ? {
                  ...local,
                  ...remote,
                  // Restore Infinity sentinel if bestTime is 0 or missing
                  bestTime:
                    remote.bestTime && remote.bestTime > 0
                      ? remote.bestTime
                      : (local?.bestTime ?? NO_BEST_TIME),
                }
              : local || {
                  solved: 0,
                  averageTime: 0,
                  bestTime: NO_BEST_TIME,
                  accuracy: 0,
                };
          }

          set((state) => ({
            profile: {
              ...state.profile,
              id: userId,
              displayName: data.display_name || state.profile.displayName,
              coins: data.coins ?? state.profile.coins,
              totalScore: data.total_score ?? state.profile.totalScore,
              totalPuzzlesSolved:
                data.puzzles_solved ?? state.profile.totalPuzzlesSolved,
              currentStreak: data.current_streak ?? state.profile.currentStreak,
              longestStreak: data.longest_streak ?? state.profile.longestStreak,
              lastPlayedDate: data.last_played_date
                ? new Date(data.last_played_date).toISOString()
                : state.profile.lastPlayedDate,
              categoryStats: sanitisedStats,
            },
          }));

          console.log(
            "[UserStore] Hydrated profile from Supabase for:",
            userId,
          );
        } catch (err) {
          console.error("[UserStore] syncFromSupabase error:", err);
        }
      },

      syncToSupabase: async () => {
        const { profile } = get();
        if (!profile.id || profile.id === "guest") return;

        try {
          // Sanitise bestTime before writing to Supabase:
          // NO_BEST_TIME (MAX_SAFE_INTEGER) → 0 so the DB stays clean
          const sanitisedStats: Record<string, any> = {};
          for (const [cat, stats] of Object.entries(profile.categoryStats)) {
            sanitisedStats[cat] = {
              ...stats,
              bestTime:
                stats.bestTime === NO_BEST_TIME || !isFinite(stats.bestTime)
                  ? 0
                  : stats.bestTime,
            };
          }

          const { error } = await supabase.from("users").upsert(
            {
              id: profile.id,
              display_name: profile.displayName,
              coins: profile.coins,
              total_score: profile.totalScore,
              puzzles_solved: profile.totalPuzzlesSolved,
              current_streak: profile.currentStreak,
              longest_streak: profile.longestStreak,
              last_played_date: new Date(profile.lastPlayedDate)
                .toISOString()
                .split("T")[0],
              category_stats: sanitisedStats,
            },
            { onConflict: "id" },
          );

          if (error) {
            console.error("[UserStore] syncToSupabase failed:", error.message);
          } else {
            console.log("[UserStore] Profile synced to Supabase");
          }
        } catch (err) {
          console.error("[UserStore] syncToSupabase error:", err);
        }
      },
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

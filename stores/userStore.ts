/**
 * userStore.ts — Zustand store for the current user's profile and stats.
 *
 * The server owns the economy. This store is a READ MIRROR of it: `coins`,
 * `totalScore`, `puzzlesSolved`, and the streaks are written only by the
 * server and copied here for display. There is deliberately no addCoins,
 * spendCoins, or syncToSupabase — the client cannot write those columns at
 * all (see migration 008), so such a function could only ever produce a
 * number that disagrees with reality.
 *
 * To change a balance, call the matching RPC in services/economyService.ts
 * and pass its returned balance to `applyServerBalance`.
 *
 * `categoryStats` is the one genuinely local piece: a convenience rollup for
 * the profile screen that nothing economic depends on.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../services/supabaseClient";
import { Category } from "../types/puzzle.types";
import { CategoryStat, UserProfile } from "../types/user.types";

// ─── Types ────────────────────────────────────────────────────────────

/**
 * A solve awaiting server submission.
 *
 * Deliberately holds no reward figures — the server decides the score and
 * the coins when the submission finally lands, so storing a guess here would
 * only create something to contradict later.
 */
export interface PendingSolve {
  puzzleId: string;
  letters: string;
  elapsedSeconds: number;
  queuedAt: string; // ISO timestamp
}

interface UserState {
  profile: UserProfile;
  /** Solves that could not reach the server yet (offline scenarios) */
  pendingSolves: PendingSolve[];

  // ─ Profile actions ──────────────────────────────────────────────
  /** Sets the authenticated user's UUID — called after auth init */
  setUserId: (id: string) => void;
  /** Mirrors a display name the server has already accepted. */
  setDisplayName: (name: string) => void;
  /** Local category rollup only. Economic totals come from the server. */
  completePuzzle: (
    category: Category,
    timeTaken: number,
    correctWords: number,
    totalWords: number,
  ) => void;

  // ─ Server balance mirror ────────────────────────────────────────
  /** Overwrites the local balance with a server-returned value. */
  applyServerBalance: (coins: number) => void;
  /** Re-reads the authoritative profile. Call after any economy action. */
  refreshBalance: () => Promise<void>;

  // ─ Offline queue ────────────────────────────────────────────────
  /** Queues a solve that could not be submitted. */
  enqueuePendingSolve: (solve: PendingSolve) => void;
  /** Removes a solve from the queue after it is accepted by the server. */
  dequeuePendingSolve: (puzzleId: string) => void;

  // ─ Supabase read ────────────────────────────────────────────────
  /**
   * Fetches the user's profile from Supabase and hydrates the local store.
   * Supabase always wins — call on every app launch.
   */
  syncFromSupabase: (userId: string) => Promise<void>;

  /**
   * Resets profile and the offline queue to initial values (e.g. before a new
   * anonymous session after sign-out).
   */
  resetLocalProfile: () => void;
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
  // Starts at zero. The welcome bonus is written by the auth trigger as a
  // ledger entry (migration 008); showing 200 here before the server has
  // granted it would display a balance the user does not have.
  coins: 0,
  totalScore: 0,
  totalPuzzlesSolved: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastPlayedDate: new Date().toISOString(),
  lastDailyBonusDate: "",
  categoryStats: initialCategoryStats,
  achievements: [],
  rank: 0,
};

// ─── Store ────────────────────────────────────────────────────────────

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: initialProfile,
      pendingSolves: [],

      // ── Profile actions ─────────────────────────────────────────
      setUserId: (id: string) =>
        set((state) => ({
          profile: { ...state.profile, id },
        })),

      setDisplayName: (name: string) =>
        set((state) => ({
          profile: { ...state.profile, displayName: name },
        })),

      applyServerBalance: (coins: number) =>
        set((state) => ({ profile: { ...state.profile, coins } })),

      refreshBalance: async () => {
        const { profile } = get();
        if (!profile.id || profile.id === "guest") return;

        const { data, error } = await supabase
          .from("users")
          .select(
            "coins, total_score, puzzles_solved, current_streak, longest_streak",
          )
          .eq("id", profile.id)
          .maybeSingle();
        if (error || !data) return;

        set((state) => ({
          profile: {
            ...state.profile,
            coins: data.coins,
            totalScore: data.total_score,
            totalPuzzlesSolved: data.puzzles_solved,
            currentStreak: data.current_streak,
            longestStreak: data.longest_streak,
          },
        }));
      },

      completePuzzle: (category, timeTaken, correctWords, totalWords) => {
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

          // totalScore and totalPuzzlesSolved are deliberately NOT touched
          // here — submit_solve owns them, and refreshBalance mirrors them.
          return {
            profile: {
              ...state.profile,
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
      enqueuePendingSolve: (solve: PendingSolve) => {
        set((state) => ({
          // Replace any earlier attempt at the same puzzle rather than
          // stacking duplicates; submission is idempotent server-side anyway.
          pendingSolves: [
            ...state.pendingSolves.filter((s) => s.puzzleId !== solve.puzzleId),
            { ...solve, queuedAt: new Date().toISOString() },
          ],
        }));
      },

      dequeuePendingSolve: (puzzleId: string) => {
        set((state) => ({
          pendingSolves: state.pendingSolves.filter(
            (s) => s.puzzleId !== puzzleId,
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

      resetLocalProfile: () =>
        set({
          profile: { ...initialProfile },
          pendingSolves: [],
        }),

      // NOTE: there is no syncToSupabase. The client has no write access to
      // the `users` table (migration 008 revokes INSERT/UPDATE/DELETE), which
      // is precisely what stops coins and scores from being forgeable. Every
      // change to that row goes through a SECURITY DEFINER RPC instead.
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

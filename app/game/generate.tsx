import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../../constants/theme";
import {
  fetchDailyPuzzle,
  fetchPuzzleById,
} from "../../services/puzzleService";
import { enterPuzzle } from "../../services/economyService";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useUserStore } from "../../stores/userStore";
import { Category, Difficulty, GridSize } from "../../types/puzzle.types";

/**
 * GenerateScreen — Transitional loading screen between category selection and gameplay.
 *
 * Fetches a pre-built daily puzzle from Supabase and charges the entry fee
 * server-side once the specific puzzle is known.
 *
 * There is deliberately no client-side generation fallback: a puzzle built
 * on-device has no row in daily_puzzles, so the server holds no answer key
 * for it and the solve could never be verified, scored, or rewarded.
 */
export default function GenerateScreen() {
  const params = useLocalSearchParams();
  const setActivePuzzle = usePuzzleStore((state) => state.setActivePuzzle);

  const category = (params.category as Category) || "general";
  const difficulty = (params.difficulty as Difficulty) || "medium";
  const gridSize = (params.size ? Number(params.size) : 8) as GridSize;
  const variant = params.variant ? Number(params.variant) : 1;
  const explicitId = params.id as string | undefined;

  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPuzzle() {
      try {
        // Flow 1: Explicit ID requested
        if (explicitId) {
          console.log(
            `[GenerateScreen] Fetching explicit puzzle ID: ${explicitId}`,
          );
          const explicitPuzzle = await fetchPuzzleById(explicitId);

          if (explicitPuzzle && mounted) {
            console.log("[GenerateScreen] ✅ Loaded requested ID from server");
            setActivePuzzle(explicitPuzzle);
            router.replace({ pathname: `/game/${explicitPuzzle.id}` } as any);
            return;
          } else {
            console.log(
              "[GenerateScreen] ⚠️ Requested ID not found, proceeding to generation",
            );
          }
        }

        // Flow 2: Match a server puzzle by its parameters.
        console.log(
          `[GenerateScreen] Fetching puzzle: ${category}/${difficulty}/${gridSize}x${gridSize}/v${variant}`,
        );

        const puzzle = await fetchDailyPuzzle(
          category,
          difficulty,
          gridSize,
          variant,
        );

        if (!puzzle) {
          // No client-side generation fallback any more. A locally generated
          // puzzle has no row in daily_puzzles, so the server has no answer
          // key for it and the solve could never be verified or rewarded.
          if (mounted) {
            setErrorMsg(
              "Today's puzzles aren't ready yet. Please try again shortly.",
            );
            setStatus("error");
          }
          return;
        }

        // Free while the daily allowance lasts; the server decides. Claiming
        // entry only after the puzzle resolves means a puzzle that fails to
        // load is never paid for, and re-entry is always free.
        try {
          const { balance } = await enterPuzzle(puzzle.id);
          useUserStore.getState().applyServerBalance(balance);
        } catch (e: any) {
          if (mounted) {
            setErrorMsg(e.message);
            setStatus("error");
          }
          return;
        }

        if (mounted) {
          console.log("[GenerateScreen] ✅ Loaded from server");
          setActivePuzzle(puzzle);
          router.replace({ pathname: `/game/${puzzle.id}` } as any);
        }
      } catch (err) {
        console.error("[GenerateScreen] Failed:", err);
        if (mounted) {
          setStatus("error");
          setErrorMsg(
            err instanceof Error ? err.message : "Failed to load puzzle",
          );
        }
      }
    }

    // Slight delay to allow transition animation to finish
    setTimeout(() => {
      loadPuzzle();
    }, 500);

    return () => {
      mounted = false;
    };
  }, [category, difficulty, gridSize, variant]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {status === "loading" && (
        <>
          <ActivityIndicator size="large" color={theme.colors.accentGold} />
          <Text style={styles.text}>Loading your puzzle...</Text>
          <Text style={styles.subtext}>
            {category.charAt(0).toUpperCase() + category.slice(1)} •{" "}
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} •{" "}
            {gridSize}x{gridSize}
          </Text>
        </>
      )}

      {status === "error" && (
        <>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.text}>Couldn't load puzzle</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setStatus("loading");
              setErrorMsg("");
              // Re-trigger by toggling a key would be more elegant,
              // but for now just go back and let them try again
              router.back();
            }}
          >
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  text: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginTop: 24,
    marginBottom: 8,
    textAlign: "center",
  },
  subtext: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textSecondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: theme.colors.accentGold,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.button,
  },
  retryText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 16,
    color: theme.colors.bgPrimary,
    fontWeight: "bold",
  },
});

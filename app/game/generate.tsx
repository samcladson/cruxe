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
import { buildPuzzle } from "../../services/crosswordEngine";
import { generatePuzzleWords } from "../../services/geminiService";
import {
  fetchDailyPuzzle,
  fetchPuzzleById,
} from "../../services/puzzleService";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { Category, Difficulty, GridSize } from "../../types/puzzle.types";

/**
 * GenerateScreen — Transitional loading screen between category selection and gameplay.
 *
 * Primary flow (v4): Fetches a pre-built daily puzzle from Supabase.
 * Fallback flow: If no server puzzle exists (e.g., cron hasn't run yet),
 * falls back to client-side Gemini generation.
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

        // Flow 2: General match fetching / generation
        console.log(
          `[GenerateScreen] Fetching puzzle fallback: ${category}/${difficulty}/${gridSize}x${gridSize}/v${variant}`,
        );

        const puzzle = await fetchDailyPuzzle(
          category,
          difficulty,
          gridSize,
          variant,
        );

        if (puzzle && mounted) {
          console.log("[GenerateScreen] ✅ Loaded from server");
          setActivePuzzle(puzzle);
          router.replace({ pathname: `/game/${puzzle.id}` } as any);
          return;
        }

        // Flow 3: Client-side generation if server puzzle not available
        console.log(
          "[GenerateScreen] ⚠️ No server puzzle found, falling back to client generation",
        );

        const words = await generatePuzzleWords(category, difficulty, gridSize);
        const generatedPuzzle = buildPuzzle(
          words,
          category,
          difficulty,
          gridSize,
        );

        if (mounted) {
          setActivePuzzle(generatedPuzzle);
          router.replace({
            pathname: `/game/${generatedPuzzle.id}`,
          } as any);
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

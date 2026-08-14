import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActiveClueBar } from "../../components/clues/ActiveClueBar";
import { CluePanel } from "../../components/clues/CluePanel";
import { CrosswordGrid } from "../../components/grid/CrosswordGrid";
import { HintOptionsModal } from "../../components/modals/HintOptionsModal";
import { SuccessModal } from "../../components/modals/SuccessModal";
import { theme } from "../../constants/theme";
import { fetchCategoryPuzzles } from "../../services/puzzleService";
import { submitSolve } from "../../services/economyService";
import { track } from "../../services/analyticsService";
import {
  calculateScore,
  DEFAULT_SCORING_CONFIG,
  ScoreBreakdown,
} from "../../services/scoreEngine";
import { canonicalCellOrder } from "../../supabase/functions/_shared/grid.ts";
import { SFX } from "../../services/soundService";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUserStore } from "../../stores/userStore";
import { Difficulty } from "../../types/puzzle.types";

// Coin rewards live in economy_config on the server. The client is told what
// it earned; it never decides.

/**
 * GameScreen — Main gameplay interface.
 *
 * Renders crossword grid, active clue bar, and clue panel.
 * On puzzle completion: records to Supabase, awards coins, updates stats/streak.
 */
export default function GameScreen() {
  const { puzzleId } = useLocalSearchParams();
  const { activePuzzle, timer, checkCompletion, getAccuracy } =
    usePuzzleStore();
  const { profile, completePuzzle, enqueuePendingSolve } = useUserStore();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [scoreEarned, setScoreEarned] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(
    null,
  );
  const [isNewStreak, setIsNewStreak] = useState(false);
  const [nextPuzzleId, setNextPuzzleId] = useState<string | null>(null);
  /** True while the solve is real but the reward has not been granted yet. */
  const [rewardPending, setRewardPending] = useState(false);

  // Prevent duplicate completion recording on re-renders
  const hasRecorded = useRef(false);

  /**
   * Full completion pipeline:
   * 1. Serialise the player's letters in the server's canonical cell order
   * 2. Show a *predicted* score immediately so the modal is never empty
   * 3. Submit to the server, which verifies the grid and decides the real
   *    score and coin reward
   * 4. Replace the prediction with the authoritative result — or, offline,
   *    queue the solve and say plainly that the reward is pending
   */
  const handleCompletion = useCallback(async () => {
    if (!activePuzzle || hasRecorded.current) return;
    hasRecorded.current = true;

    const letters = canonicalCellOrder(activePuzzle.grid)
      .map(({ row, col }) => activePuzzle.grid[row][col].userInput || " ")
      .join("");

    // Predicted only — the server recomputes from its own answer key and
    // config, and its number wins the moment it arrives.
    const predicted = calculateScore(
      {
        difficulty: activePuzzle.difficulty as Difficulty,
        gridSize: activePuzzle.gridSize,
        accuracy: getAccuracy(),
        timeTaken: timer,
        hintsUsed: activePuzzle.hintsUsed || 0,
      },
      DEFAULT_SCORING_CONFIG,
    );
    setScoreEarned(predicted.finalScore);
    setScoreBreakdown(predicted);
    setRewardPending(true);

    const todayStr = new Date().toISOString().split("T")[0];
    const lastPlayedStr = new Date(profile.lastPlayedDate)
      .toISOString()
      .split("T")[0];
    setIsNewStreak(todayStr !== lastPlayedStr);

    setShowSuccessModal(true);

    if (useSettingsStore.getState().hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    SFX.puzzleComplete();

    try {
      const result = await submitSolve(activePuzzle.id, letters, timer);

      setScoreEarned(result.score);
      setScoreBreakdown(result.breakdown);
      setCoinsEarned(result.coinsEarned);
      setRewardPending(false);

      track("puzzle_completed", {
        difficulty: activePuzzle.difficulty,
        gridSize: activePuzzle.gridSize,
        score: result.score,
        grade: result.grade,
        hintsUsed: result.hintsUsed,
        timeTaken: timer,
      });
      if (useUserStore.getState().profile.totalPuzzlesSolved === 0) {
        track("first_solve", { difficulty: activePuzzle.difficulty });
      }

      useUserStore.getState().applyServerBalance(result.newBalance);
      completePuzzle(
        activePuzzle.category as any,
        timer,
        Math.round(result.accuracy * activePuzzle.totalWords),
        activePuzzle.totalWords,
      );
      await useUserStore.getState().refreshBalance();
    } catch (err) {
      // Offline or server unreachable. The solve is real; the reward is not
      // granted yet. Queue it and say so, rather than inventing coins that
      // the server might later disagree with.
      console.warn("[GameScreen] Submission deferred:", err);
      enqueuePendingSolve({
        puzzleId: activePuzzle.id,
        letters,
        elapsedSeconds: timer,
        queuedAt: new Date().toISOString(),
      });
      setRewardPending(true);
    }

    // Find next unsolved puzzle in the same category
    try {
      const categoryPuzzles = await fetchCategoryPuzzles(
        activePuzzle.category as any,
        profile.id,
      );
      const next = categoryPuzzles.find(
        (p) => !p.isCompleted && p.id !== activePuzzle.id,
      );
      if (next) setNextPuzzleId(next.id);
    } catch {
      // Non-critical — just won't show "Next Puzzle" button
    }
  }, [activePuzzle, timer, profile.id]);

  // Funnel: entering and leaving a puzzle. `hasRecorded` distinguishes a
  // genuine abandon from a normal post-completion unmount.
  useEffect(() => {
    if (!activePuzzle) return;
    track("puzzle_started", {
      difficulty: activePuzzle.difficulty,
      gridSize: activePuzzle.gridSize,
    });
    return () => {
      if (!hasRecorded.current) {
        track("puzzle_abandoned", {
          difficulty: activePuzzle.difficulty,
          gridSize: activePuzzle.gridSize,
          secondsPlayed: usePuzzleStore.getState().timer,
        });
      }
    };
  }, [activePuzzle?.id]);

  // Trigger completion when puzzle is solved
  useEffect(() => {
    if (activePuzzle?.isComplete && !hasRecorded.current) {
      handleCompletion();
    }
  }, [activePuzzle?.isComplete, handleCompletion]);

  // Start timer interval
  useEffect(() => {
    if (!activePuzzle || activePuzzle.isComplete) return;
    const interval = setInterval(() => {
      usePuzzleStore.setState((state) => ({ timer: state.timer + 1 }));
    }, 1000);
    return () => clearInterval(interval);
  }, [activePuzzle?.isComplete]);

  if (!activePuzzle) {
    return <View style={styles.container} />;
  }

  /** Format seconds → MM:SS */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top Status Bar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <View style={styles.timerIconWrap}>
              <MaterialIcons
                name="timer"
                size={18}
                color={theme.colors.accentGold}
              />
            </View>
            <Text style={styles.timerText}>{formatTime(timer)}</Text>
          </View>

          {/* <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {activePuzzle.category?.toUpperCase()} •{" "}
              {activePuzzle.difficulty?.toUpperCase()}
            </Text>
            <Text style={styles.headerSubtitle}>
              {activePuzzle.gridSize}×{activePuzzle.gridSize} •{" "}
              {activePuzzle.totalWords} words
            </Text>
          </View> */}

          <View style={styles.headerRight}>
            <View style={styles.coinBadge}>
              <MaterialIcons
                name="monetization-on"
                size={14}
                color={theme.colors.accentGold}
              />
              <Text style={styles.coinText}>{profile.coins}</Text>
            </View>
          </View>
        </View>

        {/* Top Active Clue Section */}
        <ActiveClueBar onHintPress={() => setShowHintModal(true)} />

        {/* Crossword Grid */}
        <CrosswordGrid />

        {/* Bottom Clue Panel Section */}
        <View style={styles.bottomSection}>
          <CluePanel />
        </View>

        <SuccessModal
          visible={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          coinsEarned={coinsEarned}
          scoreEarned={scoreEarned}
          isNewStreak={isNewStreak}
          nextPuzzleId={nextPuzzleId}
          rewardPending={rewardPending}
        />
        <HintOptionsModal
          visible={showHintModal}
          onClose={() => setShowHintModal(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: theme.colors.bgPrimary,
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  timerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  timerText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: "#fff",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerTitle: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1.5,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
  },
  headerSubtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    flex: 1,
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  coinText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },

  bottomSection: {
    flex: 1,
    minHeight: 180,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
});

import { MaterialIcons } from "@expo/vector-icons";
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
import { recordCompletion } from "../../services/puzzleService";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useUserStore } from "../../stores/userStore";
import { Difficulty } from "../../types/puzzle.types";

/** Coin rewards by difficulty level */
const COIN_REWARDS: Record<Difficulty, number> = {
  [Difficulty.EASY]: 10,
  [Difficulty.MEDIUM]: 25,
  [Difficulty.HARD]: 50,
  [Difficulty.EXPERT]: 100,
};

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
  const { profile, addCoins, completePuzzle, incrementStreak } = useUserStore();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [scoreEarned, setScoreEarned] = useState(0);
  const [isNewStreak, setIsNewStreak] = useState(false);

  // Prevent duplicate completion recording on re-renders
  const hasRecorded = useRef(false);

  /**
   * Full completion pipeline:
   * 1. Calculate coin reward by difficulty
   * 2. Award coins + update category stats + increment streak (optimistic)
   * 3. Record completion to Supabase (fire-and-forget)
   * 4. Show success modal
   */
  const handleCompletion = useCallback(async () => {
    if (!activePuzzle || hasRecorded.current) return;
    hasRecorded.current = true;

    const reward = COIN_REWARDS[activePuzzle.difficulty as Difficulty] || 150;
    const accuracy = getAccuracy();

    // Scale score by difficulty to make points more competitive (lower)
    const BASE_SCORES: Record<string, number> = {
      easy: 50,
      medium: 100,
      hard: 150,
      expert: 250,
    };
    const difficultyKey = activePuzzle.difficulty || "medium";
    const baseScore = BASE_SCORES[difficultyKey] || 100;

    const calculateScore = Math.round(accuracy * baseScore);

    setCoinsEarned(reward);
    setScoreEarned(calculateScore);

    const todayStr = new Date().toISOString().split("T")[0];
    const lastPlayedStr = new Date(profile.lastPlayedDate)
      .toISOString()
      .split("T")[0];
    const isNew = todayStr !== lastPlayedStr;
    setIsNewStreak(isNew);

    // Optimistic local updates
    addCoins(reward);
    completePuzzle(
      activePuzzle.category as any,
      timer,
      Math.round(accuracy * activePuzzle.totalWords),
      activePuzzle.totalWords,
      calculateScore,
    );
    incrementStreak();

    // Record to Supabase (fire-and-forget; failures logged)
    recordCompletion({
      puzzleId: activePuzzle.id || "",
      userId: profile.id,
      score: calculateScore,
      timeTaken: timer,
      accuracy,
      hintsUsed: activePuzzle.hintsUsed || 0,
      coinsEarned: reward,
      puzzleDate: activePuzzle.date || new Date().toISOString().split("T")[0],
      category: activePuzzle.category,
      difficulty: activePuzzle.difficulty,
      gridSize: activePuzzle.gridSize,
    }).catch((err) => {
      console.warn("[GameScreen] Failed to record completion:", err);
    });

    setShowSuccessModal(true);
  }, [activePuzzle, timer, profile.id]);

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

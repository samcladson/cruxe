import { MaterialIcons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ConfettiBlast } from "../../components/animations/ConfettiBlast";
import { ActiveClueBar } from "../../components/clues/ActiveClueBar";
import { CluePanel } from "../../components/clues/CluePanel";
import { CrosswordGrid } from "../../components/grid/CrosswordGrid";
import { theme } from "../../constants/theme";
import { usePuzzleStore } from "../../stores/puzzleStore";

/**
 * GameScreen is the main gameplay interface.
 * Renders the crossword grid, active clue bar, and clue panel.
 * Navigation arrows have been removed per user preference — the player selects
 * cells by tapping them, and toggles direction via the active clue bar.
 */
export default function GameScreen() {
  const { puzzleId } = useLocalSearchParams();
  const { activePuzzle, checkCompletion } = usePuzzleStore();
  const [showConfetti, setShowConfetti] = useState(false);

  // Periodic completion check
  useEffect(() => {
    if (!activePuzzle || activePuzzle.isComplete) return;

    const interval = setInterval(() => {
      if (checkCompletion()) {
        setShowConfetti(true);
        setTimeout(() => {
          router.back();
        }, 4000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activePuzzle, checkCompletion]);

  if (!activePuzzle) {
    return <View style={styles.container} />;
  }

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
            <View style={styles.timerIconWrap}>
              <MaterialIcons
                name="timer"
                size={18}
                color={theme.colors.accentGold}
              />
            </View>
            <Text style={styles.timerText}>04:32</Text>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {activePuzzle.category?.toUpperCase()} •{" "}
              {activePuzzle.difficulty?.toUpperCase()}
            </Text>
            <Text style={styles.headerSubtitle}>
              {activePuzzle.gridSize}×{activePuzzle.gridSize} •{" "}
              {activePuzzle.totalWords} words
            </Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.coinBadge}>
              <Text style={styles.coinText}>
                {activePuzzle?.difficulty === "easy" ? "150" : "540"}
              </Text>
              <MaterialIcons
                name="monetization-on"
                size={14}
                color={theme.colors.accentGold}
              />
            </View>
          </View>
        </View>

        {/* Crossword Grid */}
        <CrosswordGrid />

        {/* Bottom section: Active Clue + Direction Tabs + Question List + Actions */}
        <View style={styles.bottomSection}>
          {/* Active Clue Bar — shows selected clue */}
          <ActiveClueBar />

          {/* Scrollable Clue Panel with tabs and action bar */}
          <CluePanel />
        </View>

        <ConfettiBlast active={showConfetti} />
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
    alignItems: "center",
    flex: 1,
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
    flex: 1,
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  coinText: {
    color: theme.colors.accentGold,
    fontSize: 13,
    fontWeight: "bold",
  },
  bottomSection: {
    flex: 1,
    minHeight: 180,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
});

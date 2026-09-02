import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { theme } from "../../constants/theme";
import { Puzzle } from "../../types/puzzle.types";

/** How long the player can sit still before we offer help. */
const IDLE_HINT_MS = 20000;

export interface CoachState {
  message: string;
  /** Shown smaller under the message, for the occasional aside. */
  detail?: string;
}

interface CoachBarProps {
  puzzle: Puzzle;
  selectedCell: { row: number; col: number } | null;
  /** True once the player has selected a clue that reads backwards. */
  hasTouchedReverse: boolean;
  onDismiss: () => void;
}

/**
 * Counts cells the player has filled in correctly.
 * Pre-filled cells don't count — the player didn't do those.
 */
function progress(puzzle: Puzzle): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const row of puzzle.grid) {
    for (const cell of row) {
      if (cell.isBlocked || cell.isPreFilled) continue;
      total++;
      if (cell.userInput && cell.userInput === cell.letter) correct++;
    }
  }
  return { correct, total };
}

/**
 * Derives what the coach should say from the puzzle's current state.
 *
 * Deliberately not a step counter. The bar never blocks input, so the player
 * will solve in whatever order they like — a counter would desynchronise the
 * moment they did something out of sequence.
 */
export function deriveCoachState(
  puzzle: Puzzle,
  selectedCell: { row: number; col: number } | null,
  hasTouchedReverse: boolean,
  idle: boolean,
): CoachState {
  const { correct, total } = progress(puzzle);
  const ratio = total === 0 ? 0 : correct / total;

  if (ratio >= 1) {
    return { message: "That's the lot. Nicely done." };
  }
  if (!selectedCell) {
    return {
      message: "Pick a square. Any square.",
      detail: "Its clue appears just below the grid.",
    };
  }
  if (correct === 0) {
    return {
      message: "Now type.",
      detail: "Tap the same square again to flip between across and down.",
    };
  }
  if (!hasTouchedReverse) {
    return {
      message: "Here's the twist — some answers run backwards.",
      detail: "The arrow on the clue always tells you which way to fill.",
    };
  }
  if (idle) {
    return {
      message: "Stuck? The bulb owes you a letter.",
      detail: "Free here. In real puzzles, hints cost coins.",
    };
  }
  if (ratio >= 0.8) {
    return { message: "Nearly." };
  }
  return { message: "Keep going." };
}

/**
 * CoachBar — a single advisory line above the grid during the tutorial.
 *
 * Never blocks input and can be dismissed outright. Experienced solvers
 * should be able to ignore it entirely and just solve the puzzle.
 */
export function CoachBar({
  puzzle,
  selectedCell,
  hasTouchedReverse,
  onDismiss,
}: CoachBarProps) {
  const [idle, setIdle] = useState(false);

  // Reset the idle timer whenever anything meaningful changes.
  const { correct } = progress(puzzle);
  useEffect(() => {
    setIdle(false);
    const t = setTimeout(() => setIdle(true), IDLE_HINT_MS);
    return () => clearTimeout(t);
  }, [correct, selectedCell?.row, selectedCell?.col]);

  const state = deriveCoachState(puzzle, selectedCell, hasTouchedReverse, idle);

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(150)}
      style={styles.bar}
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessibilityLabel={`Tutorial guidance: ${state.message} ${state.detail ?? ""}`}
    >
      <MaterialIcons
        name="school"
        size={18}
        color={theme.colors.accentGold}
        style={styles.icon}
      />
      <View style={styles.textWrap}>
        <Text style={styles.message}>{state.message}</Text>
        {state.detail ? <Text style={styles.detail}>{state.detail}</Text> : null}
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tutorial guidance"
      >
        <MaterialIcons name="close" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(238, 205, 43, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  icon: { marginTop: 1 },
  textWrap: { flex: 1 },
  message: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  detail: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
});

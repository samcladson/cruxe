import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { theme } from "../../constants/theme";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { Direction } from "../../types/puzzle.types";

interface ActiveClueBarProps {
  /** Callback fired when the lightbulb hint button is pressed */
  onHintPress?: () => void;
}

/**
 * Human-readable labels for each direction type.
 */
const DIRECTION_LABELS: Record<Direction, string> = {
  across: "ACROSS",
  down: "DOWN",
  reverse_across: "BACKWARDS",
  reverse_down: "UP",
};

/**
 * ActiveClueBar shows the currently selected clue floating above the clue panel.
 * Tapping it toggles through available directions for the selected cell.
 */
export function ActiveClueBar({ onHintPress }: ActiveClueBarProps) {
  const { activePuzzle, selectedCell, selectedDirection, toggleDirection } =
    usePuzzleStore();

  if (!activePuzzle || !selectedCell) return null;

  const currentCell = activePuzzle.grid[selectedCell.row][selectedCell.col];
  if (currentCell.isBlocked || currentCell.clueIds.length === 0) return null;

  let targetClueId = currentCell.clueIds.find((id) =>
    id.includes(selectedDirection),
  );
  if (!targetClueId) {
    targetClueId = currentCell.clueIds[0];
  }

  const clueObj = activePuzzle.clues.find((c) => c.id === targetClueId);
  if (!clueObj) return null;

  const dirLabel =
    DIRECTION_LABELS[clueObj.direction] || clueObj.direction.toUpperCase();

  const onToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleDirection();
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutDown.duration(200)}
      style={styles.containerWrap}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.clueTarget}>
              {clueObj.number} {dirLabel}
            </Text>
            <View style={styles.hintPill}>
              <Text style={styles.hintPillText}>TAP TO SWITCH</Text>
            </View>
          </View>

          <Text style={styles.clueText}>"{clueObj.clue}"</Text>
        </View>

        <TouchableOpacity
          style={styles.bulbBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onHintPress?.();
          }}
        >
          <MaterialIcons
            name="lightbulb"
            size={24}
            color={theme.colors.accentGold}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  containerWrap: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2a2721",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
    padding: 10,
    gap: 10,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  clueTarget: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: theme.colors.accentGold,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  hintPill: {
    backgroundColor: "rgba(238, 205, 43, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hintPillText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 8,
    fontWeight: "bold",
    color: theme.colors.accentGold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  clueText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 18,
    color: "#fff",
    fontWeight: "500",
    lineHeight: 24,
  },
  bulbBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
});

import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { theme } from "../../constants/theme";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { Direction } from "../../types/puzzle.types";
import { findClueId } from "../../utils/clueId";

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
 * A permanent arrow for every clue, not just the odd ones.
 *
 * Cruxe places words that read right-to-left and bottom-to-top, which is not
 * how crosswords normally work. The one-time tooltip below explains it once;
 * this arrow is what reminds the player forever after, and lets someone who
 * dismissed the tooltip still infer the rule.
 */
const DIRECTION_ARROWS: Record<Direction, keyof typeof MaterialIcons.glyphMap> = {
  across: "arrow-forward",
  down: "arrow-downward",
  reverse_across: "arrow-back",
  reverse_down: "arrow-upward",
};

const REVERSE_DIRECTIONS: Direction[] = ["reverse_across", "reverse_down"];

/**
 * ActiveClueBar shows the currently selected clue floating above the clue panel.
 * Tapping it toggles through available directions for the selected cell.
 */
export function ActiveClueBar({ onHintPress }: ActiveClueBarProps) {
  const { activePuzzle, selectedCell, selectedDirection, toggleDirection } =
    usePuzzleStore();
  const hasSeenReverseHint = useSettingsStore((s) => s.hasSeenReverseHint);
  const setHasSeenReverseHint = useSettingsStore(
    (s) => s.setHasSeenReverseHint,
  );

  if (!activePuzzle || !selectedCell) return null;

  const currentCell = activePuzzle.grid[selectedCell.row][selectedCell.col];
  if (currentCell.isBlocked || currentCell.clueIds.length === 0) return null;

  let targetClueId = findClueId(currentCell.clueIds, selectedDirection);
  if (!targetClueId) {
    targetClueId = currentCell.clueIds[0];
  }

  const clueObj = activePuzzle.clues.find((c) => c.id === targetClueId);
  if (!clueObj) return null;

  const dirLabel =
    DIRECTION_LABELS[clueObj.direction] || clueObj.direction.toUpperCase();
  const dirArrow = DIRECTION_ARROWS[clueObj.direction] ?? "arrow-forward";
  const isReverse = REVERSE_DIRECTIONS.includes(clueObj.direction);

  // Explain backwards clues once, the first time one is actually selected —
  // in the tutorial or in a real puzzle, whichever the player reaches first.
  const showReverseHint = isReverse && !hasSeenReverseHint;

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
      {showReverseHint && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.reverseHint}>
          <MaterialIcons
            name="swap-horiz"
            size={16}
            color={theme.colors.accentGold}
          />
          <Text style={styles.reverseHintText}>
            Heads up — this answer reads{" "}
            {clueObj.direction === "reverse_across" ? "backwards" : "upwards"}.
            The arrow always shows which way to fill.
          </Text>
          <TouchableOpacity
            onPress={() => setHasSeenReverseHint(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Got it, dismiss this explanation"
          >
            <MaterialIcons
              name="close"
              size={16}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        </Animated.View>
      )}
      <TouchableOpacity
        style={styles.card}
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Clue ${clueObj.number} ${dirLabel}: ${clueObj.clue}`}
        accessibilityHint="Double tap to switch direction"
      >
        <View style={styles.content}>
          <View style={styles.topRow}>
            <MaterialIcons
              name={dirArrow}
              size={13}
              color={
                isReverse ? theme.colors.accentGold : theme.colors.textSecondary
              }
              style={styles.dirArrow}
            />
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
          accessibilityRole="button"
          accessibilityLabel="Open hints"
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
  dirArrow: { marginRight: 5 },
  reverseHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.25)",
  },
  reverseHintText: {
    flex: 1,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },
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

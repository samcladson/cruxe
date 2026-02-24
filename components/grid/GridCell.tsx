import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../constants/theme";
import { useSettingsStore } from "../../stores/settingsStore";
import { GridCell as GridCellType } from "../../types/puzzle.types";

interface GridCellProps {
  cell: GridCellType;
  isSelected: boolean;
  isActiveWord: boolean;
  cellSize: number;
  onPress: (row: number, col: number) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * GridCell renders a single cell of the crossword grid.
 * Classic crossword style adapted to the dark Obsidian theme:
 * - Blocked cells are solid dark
 * - Active cells highlighted with gold border
 * - Clue numbers in top-left corner
 * - Letters centered with monospace font
 */
export const GridCell = React.memo(
  ({ cell, isSelected, isActiveWord, cellSize, onPress }: GridCellProps) => {
    const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
    const flashScale = useSharedValue(1);

    const handlePress = () => {
      if (hapticsEnabled) {
        if (isSelected) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Haptics.selectionAsync();
        }
      }
      onPress(cell.row, cell.col);
    };

    React.useEffect(() => {
      if (cell.userInput) {
        flashScale.value = withSequence(
          withTiming(1.08, { duration: 50, easing: Easing.out(Easing.ease) }),
          withSpring(1, { damping: 10, stiffness: 400 }),
        );
      }
    }, [cell.userInput, flashScale]);

    const animatedScaleStyle = useAnimatedStyle(() => ({
      transform: [{ scale: flashScale.value }],
    }));

    // Blocked cell — solid dark square
    if (cell.isBlocked) {
      return (
        <View
          style={[
            styles.cellBase,
            styles.blocked,
            { width: cellSize, height: cellSize },
          ]}
        />
      );
    }

    // Determine background color based on cell state
    let backgroundColor = "#1e1e1e";
    if (isSelected) {
      backgroundColor = "#2a4a5a";
    } else if (isActiveWord) {
      backgroundColor = "#252520";
    }
    if (cell.state === "correct") {
      backgroundColor = "#1a2e1a";
    }
    if (cell.isPreFilled && !isSelected && !isActiveWord) {
      backgroundColor = "#2a2518";
    }

    return (
      <AnimatedPressable
        style={[
          styles.cellBase,
          styles.cellActive,
          {
            width: cellSize,
            height: cellSize,
            backgroundColor,
          },
          isSelected && styles.selectedGlow,
        ]}
        onPress={handlePress}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.contentContainer,
            animatedScaleStyle,
          ]}
        >
          {cell.clueNumbers.length > 0 && (
            <Text
              style={[
                styles.number,
                { fontSize: Math.max(cellSize * 0.22, 7) },
                isSelected && styles.numberActive,
              ]}
            >
              {cell.clueNumbers[0]}
            </Text>
          )}

          {!!cell.userInput && (
            <Text
              style={[
                styles.letter,
                { fontSize: cellSize * 0.48 },
                cell.isPreFilled && styles.letterHint,
                cell.state === "correct" && styles.letterCorrect,
              ]}
            >
              {cell.userInput}
            </Text>
          )}
        </Animated.View>
      </AnimatedPressable>
    );
  },
);

const styles = StyleSheet.create({
  cellBase: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  blocked: {
    backgroundColor: "rgba(238, 205, 43, 0.12)",
    borderColor: "rgba(238, 205, 43, 0.08)",
  },
  cellActive: {},
  selectedGlow: {
    borderWidth: 2,
    borderColor: theme.colors.accentGold,
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 10,
  },
  contentContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  number: {
    position: "absolute",
    top: 1,
    left: 2,
    fontFamily: theme.typography.cellNumber.fontFamily,
    color: "rgba(255,255,255,0.55)",
    zIndex: 1,
  },
  numberActive: {
    color: theme.colors.accentGold,
  },
  letter: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    color: "#fff",
    fontWeight: "bold",
    includeFontPadding: false,
  },
  letterHint: {
    color: theme.colors.accentGold,
  },
  letterCorrect: {
    color: theme.colors.accentGreen,
  },
});

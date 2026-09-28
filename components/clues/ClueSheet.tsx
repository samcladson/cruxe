import React, { useEffect, useState } from "react";
import { Keyboard, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../constants/theme";
import { CluePanel } from "./CluePanel";

/** How much of the screen the sheet covers once raised. */
const EXPANDED_FRACTION = 0.5;

/** A raised sheet is always at least this much taller than a resting one. */
const MIN_RAISE = 120;

/** The sheet's top border, counted into the height its controls need. */
const BORDER = 1;

interface ClueSheetProps {
  /** The resting height, decided with the grid's by usePuzzleLayout. */
  restingHeight: number;
  /** Whether the resting sheet lists clues. */
  showList: boolean;
  /**
   * Reports the height the sheet needs for its controls alone (direction
   * tabs, action bar, border), so the screen can share its height with it.
   */
  onChromeHeightChange?: (height: number) => void;
}

/**
 * The clue list as a sheet at the foot of the puzzle screen.
 *
 * Resting, it either fills the space below the grid with clues for the
 * current direction, or, when no clue row fits, is just its controls on the
 * bottom edge with the grid centred above (utils/sheetLayout.ts). Raised, it
 * covers the lower half of the screen so every clue in a direction can be
 * read at once.
 *
 * It never moves for the keyboard. While typing, the keyboard covers it and
 * a slim Done bar rides on the keyboard instead (KeyboardDoneBar), which is
 * how FINISH is reached on iOS, where there is no back gesture to close the
 * keyboard. A sheet that rode on the keyboard cluttered the screen and shifted
 * out of line when the keyboard closed.
 *
 * Positioned absolutely rather than grown in place: on Android a child cannot
 * be relied on to draw outside its parent's bounds, so a panel that expanded
 * within the layout would be clipped at the grid instead of covering it.
 */
export function ClueSheet({
  restingHeight,
  showList,
  onChromeHeightChange,
}: ClueSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [chromeHeight, setChromeHeight] = useState(0);

  const raisedHeight = Math.max(
    Math.round(screenHeight * EXPANDED_FRACTION),
    restingHeight + MIN_RAISE,
  );

  useEffect(() => {
    if (chromeHeight > 0) onChromeHeightChange?.(chromeHeight + BORDER);
  }, [chromeHeight, onChromeHeightChange]);

  const height = useSharedValue(restingHeight);

  useEffect(() => {
    height.value = withTiming(expanded ? raisedHeight : restingHeight, {
      duration: 240,
    });
  }, [expanded, raisedHeight, restingHeight]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  const toggle = () => {
    setExpanded((wasExpanded) => {
      // Raising the sheet is browsing, not typing, and the keyboard would
      // otherwise cover most of what was just opened.
      if (!wasExpanded) Keyboard.dismiss();
      return !wasExpanded;
    });
  };

  return (
    <Animated.View style={[styles.sheet, animatedStyle]}>
      <CluePanel
        expanded={expanded}
        showList={showList}
        onToggleExpanded={toggle}
        onClueSelected={() => setExpanded(false)}
        onChromeHeight={setChromeHeight}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.bgPrimary,
    borderTopWidth: BORDER,
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    // Above the grid, which slides up behind it when the keyboard opens.
    zIndex: 30,
    elevation: 30,
  },
});

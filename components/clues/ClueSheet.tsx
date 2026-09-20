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

/** Used until the panel has reported how tall its controls are. */
const FALLBACK_COLLAPSED_HEIGHT = 96;

interface ClueSheetProps {
  /**
   * Reports the height the sheet rests at, so the screen can reserve exactly
   * that much beneath the grid and no more.
   */
  onRestHeightChange?: (height: number) => void;
}

/**
 * The clue list as a sheet that can be raised over the grid.
 *
 * Collapsed, it is only the direction tabs and the action bar — the clue
 * list is hidden and that space belongs to the grid. Raised, it covers the
 * lower half of the screen so every clue in a direction can be read at once.
 *
 * The action bar stays visible in both states because FINISH lives there;
 * hiding it would mean a puzzle that cannot be completed without first
 * opening a list you do not need.
 *
 * Positioned absolutely rather than grown in place: on Android a child cannot
 * be relied on to draw outside its parent's bounds, so a panel that expanded
 * within the layout would be clipped at the grid instead of covering it.
 */
export function ClueSheet({ onRestHeightChange }: ClueSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [chromeHeight, setChromeHeight] = useState(0);

  const restingHeight = chromeHeight || FALLBACK_COLLAPSED_HEIGHT;

  useEffect(() => {
    onRestHeightChange?.(restingHeight);
  }, [restingHeight, onRestHeightChange]);
  const raisedHeight = Math.round(screenHeight * EXPANDED_FRACTION);

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
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    // Above the grid, which slides up behind it when the keyboard opens.
    zIndex: 30,
    elevation: 30,
  },
});

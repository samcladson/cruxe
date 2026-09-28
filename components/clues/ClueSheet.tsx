import React, { useEffect, useState } from "react";
import { Keyboard, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../constants/theme";
import { sheetLayout } from "../../utils/sheetLayout";
import { CluePanel } from "./CluePanel";

/** How much of the screen the sheet covers once raised. */
const EXPANDED_FRACTION = 0.5;

/** A raised sheet is always at least this much taller than a resting one. */
const MIN_RAISE = 120;

interface ClueSheetProps {
  /** Height the grid leaves free beneath it, which the resting sheet fills. */
  spaceBelowGrid: number;
  /** How far the keyboard reaches up over the bottom of the screen. */
  keyboardOverlap: number;
  /**
   * Reports the height of the controls that stay visible at all times, so
   * the screen can keep the typed row clear of them and reserve their space.
   */
  onChromeHeightChange?: (height: number) => void;
}

/**
 * The clue list as a sheet at the foot of the puzzle screen.
 *
 * Resting, it fills the space the grid leaves, listing clues for the current
 * direction when there is room, so a tall phone shows clues rather than an
 * empty band. Raised, it covers the lower half of the screen so every clue in
 * a direction can be read at once. While the keyboard is up it shrinks to its
 * controls and rides on top of the keyboard, the same on iOS and Android.
 *
 * The action bar stays visible in every state because FINISH lives there; on
 * iOS, which has no back gesture to dismiss the keyboard, hiding it would
 * leave no way to finish while typing.
 *
 * Positioned absolutely rather than grown in place: on Android a child cannot
 * be relied on to draw outside its parent's bounds, so a panel that expanded
 * within the layout would be clipped at the grid instead of covering it.
 */
export function ClueSheet({
  spaceBelowGrid,
  keyboardOverlap,
  onChromeHeightChange,
}: ClueSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [chromeHeight, setChromeHeight] = useState(0);

  const layout = sheetLayout({ spaceBelowGrid, chromeHeight, keyboardOverlap });
  const raisedHeight = Math.max(
    Math.round(screenHeight * EXPANDED_FRACTION),
    layout.restingHeight + MIN_RAISE,
  );

  useEffect(() => {
    if (chromeHeight > 0) onChromeHeightChange?.(chromeHeight);
  }, [chromeHeight, onChromeHeightChange]);

  const height = useSharedValue(layout.restingHeight);
  const bottom = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(expanded ? raisedHeight : layout.restingHeight, {
      duration: 240,
    });
  }, [expanded, raisedHeight, layout.restingHeight]);

  useEffect(() => {
    bottom.value = withTiming(layout.bottom, { duration: 180 });
  }, [layout.bottom]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    bottom: bottom.value,
  }));

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
        showList={layout.showList}
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

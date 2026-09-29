import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../constants/theme";

/**
 * On iOS the keyboard has rounded top corners, so a full-width square bar
 * leaves a gap at each end and looks detached. There the bar is a rounded pill
 * floating just above the keyboard, inset from the edges: it never has to
 * match the keyboard's shape. Android's keyboard is flat, so a flat bar sits
 * flush on it.
 */
const FLOATING = Platform.OS === "ios";
const BAR_HEIGHT = 40;
const FLOAT_GAP = 6;

/** Height the grid keeps the typed row clear of: the bar and its gap. */
export const DONE_BAR_HEIGHT = BAR_HEIGHT + (FLOATING ? FLOAT_GAP : 0);

/** The arrow's size. */
const ICON_SIZE = 20;

/**
 * iOS reports the keyboard as it starts to rise, Android once it has risen.
 * On iOS the bar waits for most of the rise, so it does not appear floating
 * above a keyboard that has not arrived yet.
 */
const SHOW_DELAY_MS = Platform.OS === "ios" ? 160 : 0;
const SHOW_MS = 120;

interface KeyboardDoneBarProps {
  /** How far the keyboard reaches up over the screen's body; 0 when closed. */
  keyboardOverlap: number;
}

/**
 * A slim bar on top of the keyboard with a single Done button, the standard
 * iPhone pattern. It is how the keyboard is closed on the puzzle screen to
 * reach FINISH and the clue list, which the keyboard covers while typing; iOS
 * has no back gesture to do it.
 *
 * Nothing else on the screen moves for the keyboard, so there is nothing for
 * this to fall out of line with. It sits wherever the keyboard's top edge is,
 * appears once the keyboard is up, and vanishes the moment it starts to close.
 */
export function KeyboardDoneBar({ keyboardOverlap }: KeyboardDoneBarProps) {
  const open = keyboardOverlap > 0;
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = open
      ? withDelay(SHOW_DELAY_MS, withTiming(1, { duration: SHOW_MS }))
      : 0;
  }, [open]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!open) return null;

  return (
    <Animated.View
      style={[
        styles.bar,
        FLOATING && styles.barFloating,
        { bottom: keyboardOverlap + (FLOATING ? FLOAT_GAP : 0) },
        style,
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.done}
        onPress={() => Keyboard.dismiss()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Hide keyboard"
      >
        <Text style={styles.doneText}>Done</Text>
        <MaterialIcons
          name="keyboard-arrow-down"
          size={ICON_SIZE}
          color={theme.colors.accentGold}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: theme.colors.bgSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
    // Above the clue sheet, which the keyboard covers while typing.
    zIndex: 40,
    elevation: 40,
  },
  barFloating: {
    left: 12,
    right: 12,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  done: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    height: BAR_HEIGHT,
  },
  doneText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.accentGold,
    // Android pads text above the ascender, which sat "Done" about 2pt below
    // the arrow and the bar's centre (measured on a device). Without it the
    // lowercase letters, which carry the word visually, centre on the bar.
    includeFontPadding: false,
    textAlignVertical: "center",
    // Optical centring. The word's box is centred, but the eye centres on its
    // lowercase letters, which Manrope sets 1.5pt below the box's middle
    // (measured on a device: "one" centred 5.5px below the arrow and the bar).
    // Lifting the label by that much lines the letters up with both.
    transform: [{ translateY: -1.5 }],
  },
});

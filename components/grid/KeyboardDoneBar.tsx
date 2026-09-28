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

/** The bar's height. The grid keeps the typed row clear of it. */
export const DONE_BAR_HEIGHT = 40;

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
      style={[styles.bar, { bottom: keyboardOverlap }, style]}
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
          size={20}
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
    height: DONE_BAR_HEIGHT,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: theme.colors.bgSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
    // Above the clue sheet, which the keyboard covers while typing.
    zIndex: 40,
    elevation: 40,
  },
  done: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    height: DONE_BAR_HEIGHT,
  },
  doneText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.accentGold,
  },
});

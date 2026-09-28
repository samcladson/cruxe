import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../constants/theme";

/** How far the fade reaches down from the clue bar's edge. */
const FADE_HEIGHT = 44;

/**
 * A soft fade along the top of the grid's area, so rows sliding up under the
 * clue bar while typing melt away rather than stopping at a hard edge. Shown
 * only while the grid is actually slid up, so it never dims the top row at
 * rest. Place it as the last child of the area that clips the grid.
 */
export function GridTopFade({ visible }: { visible: boolean }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 180 });
  }, [visible]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.fade, style]} pointerEvents="none">
      <LinearGradient
        colors={[
          theme.colors.bgPrimary,
          "rgba(10,10,10,0.75)",
          "rgba(10,10,10,0)",
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
});

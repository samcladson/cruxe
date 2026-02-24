import React, { useEffect } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

const CONFETTI_COLORS = ["#C9A84C", "#2ECC71", "#4A90D9", "#E74C3C", "#F0EDE8"];
const CONFETTI_COUNT = 40;

const ConfettiPiece = ({ index }: { index: number }) => {
  const startX = useSharedValue(Math.random() * width);
  const startY = useSharedValue(-50);

  const endX = startX.value + (Math.random() * 200 - 100);
  const endY = height + 50;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      Math.random() * 800,
      withRepeat(
        withTiming(1, {
          duration: 1500 + Math.random() * 1000,
          easing: Easing.linear,
        }),
        -1, // infinite
        false,
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: startX.value + (endX - startX.value) * progress.value },
        { translateY: startY.value + (endY - startY.value) * progress.value },
        { rotate: `${progress.value * 360 * (index % 2 === 0 ? 1 : -1)}deg` },
        { scale: Math.random() * 0.5 + 0.5 },
      ],
      opacity: 1 - progress.value * 0.5,
    };
  });

  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];

  return (
    <Animated.View
      style={[styles.confetti, { backgroundColor: color }, animatedStyle]}
    />
  );
};

export function ConfettiBlast({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  confetti: {
    position: "absolute",
    width: 10,
    height: 16,
    borderRadius: 2,
  },
});

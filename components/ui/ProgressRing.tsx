import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { theme } from "../../constants/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  showText?: boolean;
}

export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 4,
  color = theme.colors.accentGold,
  showText = false,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, {
      duration: 800,
      easing: Easing.out(Easing.ease),
    });
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset =
      circumference - animatedProgress.value * circumference;
    const stroke = interpolateColor(
      animatedProgress.value,
      [0, 1],
      [typeof color === "string" ? color : theme.colors.accentBlue, color],
    );

    return {
      strokeDashoffset,
      stroke,
    };
  });

  return (
    <View style={[{ width: size, height: size }, styles.container]}>
      <Svg
        height={size}
        width={size}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          stroke={theme.colors.bgTertiary}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <AnimatedCircle
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
        />
      </Svg>
      {showText && (
        <View style={[StyleSheet.absoluteFill, styles.textContainer]}>
          <Text style={styles.text}>{Math.round(progress * 100)}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
  },
});

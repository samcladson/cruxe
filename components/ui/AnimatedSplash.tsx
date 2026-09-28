import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

/**
 * AnimatedSplash — the logo's launch moment, "Four directions".
 *
 * The native splash shows the still logo: a gold centre cell with four arms.
 * This takes over from it as soon as the app can draw. The arms draw back into
 * the centre (which also hides any small difference between the system's
 * splash size and ours, since the OS sizes that image itself), the centre
 * pops, and the arms shoot out one at a time: up, right, down, left, the four
 * ways a Cruxe answer can run. A glow, then the whole thing fades into the app
 * that has been loading underneath all along, so it adds no waiting time.
 *
 * Skipped entirely when the phone asks for reduced motion.
 */

const CELL = 32;
const GAP = 5;
const STEP = CELL + GAP;

const BG = "#0a0a0a";
const GOLD = "#eecd2b";
const ARM_FILL = "#111111";

/** Each arm's resting offset from the centre, in the order they fire. */
const ARMS = [
  { key: "up", x: 0, y: -STEP },
  { key: "right", x: STEP, y: 0 },
  { key: "down", x: 0, y: STEP },
  { key: "left", x: -STEP, y: 0 },
] as const;

const DRAW_BACK_MS = 180;
const FIRST_ARM_AT = 330;
const ARM_STAGGER = 100;
const GLOW_AT = 820;
const FADE_AT = 1080;
const FADE_MS = 260;

const SPRING = { damping: 11, stiffness: 190, mass: 0.7 };

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();

  const arms = [
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
  ];
  const core = useSharedValue(1);
  const glow = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      onDone();
      return;
    }

    arms.forEach((arm, i) => {
      arm.value = withSequence(
        withTiming(0, {
          duration: DRAW_BACK_MS,
          easing: Easing.in(Easing.quad),
        }),
        withDelay(
          FIRST_ARM_AT - DRAW_BACK_MS + i * ARM_STAGGER,
          withSpring(1, SPRING),
        ),
      );
    });

    core.value = withSequence(
      withTiming(0.88, { duration: DRAW_BACK_MS }),
      withTiming(1.16, { duration: 110, easing: Easing.out(Easing.quad) }),
      withSpring(1, SPRING),
    );

    glow.value = withDelay(
      GLOW_AT,
      withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(0, { duration: 260 }),
      ),
    );

    fade.value = withDelay(
      FADE_AT,
      withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
    // Runs once, on mount: this is a single launch moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: core.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.7 + glow.value * 0.5 }],
  }));

  if (reduceMotion) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.logo}>
        <Animated.View style={[styles.glow, glowStyle]} />
        {ARMS.map((arm, i) => (
          <Arm key={arm.key} progress={arms[i]} x={arm.x} y={arm.y} />
        ))}
        <Animated.View style={[styles.cell, styles.core, coreStyle]}>
          <View style={styles.coreShine} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** One arm: at 0 it is tucked behind the centre, at 1 it is in place. */
function Arm({
  progress,
  x,
  y,
}: {
  progress: SharedValue<number>;
  x: number;
  y: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value > 0.02 ? 1 : 0,
    transform: [
      { translateX: x * progress.value },
      { translateY: y * progress.value },
      { scale: 0.5 + 0.5 * progress.value },
    ],
  }));
  return <Animated.View style={[styles.cell, styles.arm, style]} />;
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    elevation: 1000,
  },
  logo: {
    width: CELL,
    height: CELL,
    alignItems: "center",
    justifyContent: "center",
  },
  cell: {
    position: "absolute",
    width: CELL,
    height: CELL,
    borderRadius: 8,
  },
  arm: {
    backgroundColor: ARM_FILL,
    borderWidth: 2.5,
    borderColor: GOLD,
  },
  core: {
    backgroundColor: GOLD,
    overflow: "hidden",
  },
  // A lighter upper-left, echoing the gradient on the logo's centre cell.
  coreShine: {
    position: "absolute",
    top: -CELL * 0.4,
    left: -CELL * 0.4,
    width: CELL * 1.1,
    height: CELL * 1.1,
    borderRadius: CELL,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  glow: {
    position: "absolute",
    width: STEP * 4,
    height: STEP * 4,
    borderRadius: STEP * 2,
    backgroundColor: "rgba(238,205,43,0.16)",
  },
});

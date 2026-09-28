import React, { useEffect, useState } from "react";
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
 * The native splash is only the dark background, with no logo on it (see
 * `splash-blank.png` in app.json), so the logo is never seen standing still:
 * the first thing a player sees is it building. The gold centre pops in, then
 * the four arms shoot out one at a time: up, right, down, left, the four ways
 * a Cruxe answer can run. A glow, then it fades into the app.
 *
 * It needs no fonts, so it starts the moment the app can draw, while fonts and
 * everything else load underneath. If loading outlasts the animation, the
 * finished logo holds until `ready`, so the fade never reveals a blank screen.
 *
 * With reduced motion on, the finished logo is shown still until `ready`.
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

const FIRST_ARM_AT = 200;
const ARM_STAGGER = 100;
const GLOW_AT = 700;
const GLOW_MS = 400;
const FADE_MS = 260;

const SPRING = { damping: 11, stiffness: 190, mass: 0.7 };

interface AnimatedSplashProps {
  /** True once the app underneath can be shown. */
  ready: boolean;
  /** Fired once the logo's first frame is on screen: hide the native splash. */
  onVisible: () => void;
  /** Fired when the overlay has faded out and can be removed. */
  onDone: () => void;
}

export function AnimatedSplash({ ready, onVisible, onDone }: AnimatedSplashProps) {
  const reduceMotion = useReducedMotion();
  const [introDone, setIntroDone] = useState(false);

  const start = reduceMotion ? 1 : 0;
  const arms = [
    useSharedValue(start),
    useSharedValue(start),
    useSharedValue(start),
    useSharedValue(start),
  ];
  const core = useSharedValue(start);
  const glow = useSharedValue(0);
  const fade = useSharedValue(1);

  // The build-up. Runs once, on mount: this is a single launch moment.
  useEffect(() => {
    if (reduceMotion) {
      setIntroDone(true);
      return;
    }

    core.value = withSequence(
      withTiming(1.16, { duration: 170, easing: Easing.out(Easing.quad) }),
      withSpring(1, SPRING),
    );

    arms.forEach((arm, i) => {
      arm.value = withDelay(
        FIRST_ARM_AT + i * ARM_STAGGER,
        withSpring(1, SPRING),
      );
    });

    glow.value = withDelay(
      GLOW_AT,
      withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(0, { duration: GLOW_MS - 140 }, (finished) => {
          if (finished) runOnJS(setIntroDone)(true);
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leave only when the intro has played and the app is ready to be seen.
  useEffect(() => {
    if (!introDone || !ready) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    fade.value = withTiming(0, { duration: FADE_MS }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introDone, ready]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: core.value > 0.02 ? 1 : 0,
    transform: [{ scale: core.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.7 + glow.value * 0.5 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      onLayout={onVisible}
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

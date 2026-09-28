import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
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
 * The gold centre pops in, then the four arms shoot out one at a time: up,
 * right, down, left, the four ways a Cruxe answer can run. A glow, then it
 * fades into the app, which has been loading underneath.
 *
 * Where it plays:
 * - Android 12+: the system plays the build-up itself from the moment the
 *   icon is tapped (plugins/withAnimatedSplash.js), before any app code runs.
 *   This picks up on its final frame, the complete logo at the same size and
 *   position, and carries on with the glow and the fade.
 * - iOS and older Android: launch screens there cannot animate (Apple requires
 *   them static), so the native splash is the dark background alone and this
 *   plays the build-up on the app's first frame.
 *
 * It holds the finished logo until `ready`, so the fade never reveals a blank
 * screen. With reduced motion on, the finished logo is shown still.
 *
 * Geometry must match plugins/withAnimatedSplash.js.
 */

const CELL = 40;
const GAP = 6;
const STEP = CELL + GAP;
const RADIUS = 10;
const STROKE = 2.5;

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
const BUILD_MS = 800;
const GLOW_MS = 400;
const FADE_MS = 260;

/**
 * On Android 12+ the app can be ready before the system's 800ms animation has
 * finished. Keeping the native splash up this much longer lets it land on its
 * final frame, rather than being cut to the complete logo.
 */
const NATIVE_FINISH_MS = 300;

const SPRING = { damping: 11, stiffness: 190, mass: 0.7 };

/** Whether the system has already played the build-up (Android 12+). */
const NATIVE_INTRO =
  Platform.OS === "android" && Number(Platform.Version) >= 31;

interface AnimatedSplashProps {
  /** True once the app underneath can be shown. */
  ready: boolean;
  /** Fired once the logo is on screen: hide the native splash. */
  onVisible: () => void;
  /** Fired when the overlay has faded out and can be removed. */
  onDone: () => void;
}

export function AnimatedSplash({ ready, onVisible, onDone }: AnimatedSplashProps) {
  const reduceMotion = useReducedMotion();
  const buildHere = !NATIVE_INTRO && !reduceMotion;
  const [introDone, setIntroDone] = useState(false);

  const start = buildHere ? 0 : 1;
  const arms = [
    useSharedValue(start),
    useSharedValue(start),
    useSharedValue(start),
    useSharedValue(start),
  ];
  const core = useSharedValue(start);
  const glow = useSharedValue(0);
  const fade = useSharedValue(1);

  // The build-up (where the system did not already play it), then the glow.
  // Runs once, on mount: this is a single launch moment.
  useEffect(() => {
    if (reduceMotion) {
      setIntroDone(true);
      return;
    }

    if (buildHere) {
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
    }

    glow.value = withDelay(
      buildHere ? BUILD_MS - 100 : NATIVE_FINISH_MS,
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

  const handleLayout = () => {
    if (NATIVE_INTRO) setTimeout(onVisible, NATIVE_FINISH_MS);
    else onVisible();
  };

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
      onLayout={handleLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.logo}>
        <Animated.View style={[styles.glow, glowStyle]} />
        {ARMS.map((arm, i) => (
          <Arm key={arm.key} progress={arms[i]} x={arm.x} y={arm.y} />
        ))}
        <Animated.View style={[styles.cell, styles.core, coreStyle]} />
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
    borderRadius: RADIUS,
  },
  arm: {
    backgroundColor: ARM_FILL,
    borderWidth: STROKE,
    borderColor: GOLD,
  },
  core: {
    backgroundColor: GOLD,
  },
  glow: {
    position: "absolute",
    width: STEP * 4,
    height: STEP * 4,
    borderRadius: STEP * 2,
    backgroundColor: "rgba(238,205,43,0.16)",
  },
});

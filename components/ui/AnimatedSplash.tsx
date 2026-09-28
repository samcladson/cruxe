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
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/**
 * AnimatedSplash — the logo's launch moment, "Four directions".
 *
 * The gold centre pops in, the four arms shoot out one at a time (up, right,
 * down, left: the four ways a Cruxe answer can run), a soft gold glow swells
 * and fades behind the finished logo, and then it fades into the app.
 *
 * Where it plays:
 * - Android 12+: the system plays all of that from the moment the icon is
 *   tapped (plugins/withAnimatedSplash.js), before any app code runs. This
 *   picks up on its final frame, the complete logo at the same size and
 *   position, and only fades it into the app.
 * - iOS and older Android: launch screens there cannot animate (Apple requires
 *   them static), so the native splash is the dark background alone and this
 *   plays the whole thing on the app's first frame.
 *
 * If the app is still loading once it has played, the finished logo stays on
 * screen until `ready`, so the fade never reveals a blank screen. With reduced
 * motion on, the finished logo is shown still.
 *
 * Geometry must match plugins/withAnimatedSplash.js (a test checks this).
 */

const CELL = 40;
const GAP = 6;
const STEP = CELL + GAP;
const RADIUS = 10;
const STROKE = 2.5;
/** Kept inside the 90dp the Android splash can show without clipping. */
const GLOW_RADIUS = 75;

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
const GLOW_IN_MS = 140;
const GLOW_OUT_MS = 260;
const GLOW_PEAK = 0.4;
const FADE_MS = 260;

/**
 * On Android 12+ the app can be ready before the system's animation has
 * finished. Keeping the native splash up this much longer after the overlay
 * appears lets it play out, rather than being cut to the complete logo.
 */
const NATIVE_FINISH_MS = 500;

const SPRING = { damping: 11, stiffness: 190, mass: 0.7 };

/** Whether the system has already played the animation (Android 12+). */
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
  const playHere = !NATIVE_INTRO && !reduceMotion;
  const [played, setPlayed] = useState(!playHere);

  const start = playHere ? 0 : 1;
  const arms = [
    useSharedValue(start),
    useSharedValue(start),
    useSharedValue(start),
    useSharedValue(start),
  ];
  const core = useSharedValue(start);
  const glow = useSharedValue(0);
  const fade = useSharedValue(1);

  // The build-up and the glow, where the system did not already play them.
  // Runs once, on mount: this is a single launch moment.
  useEffect(() => {
    if (!playHere) return;

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
      BUILD_MS - 100,
      withSequence(
        withTiming(1, { duration: GLOW_IN_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: GLOW_OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) runOnJS(setPlayed)(true);
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade into the app once it has played and the app can be seen.
  useEffect(() => {
    if (!played || !ready) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    fade.value = withTiming(0, { duration: FADE_MS }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played, ready]);

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
    opacity: glow.value * GLOW_PEAK,
    transform: [{ scale: 0.7 + glow.value * 0.35 }],
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
        <Animated.View style={[styles.glow, glowStyle]}>
          <Svg width={GLOW_RADIUS * 2} height={GLOW_RADIUS * 2}>
            <Defs>
              <RadialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={GOLD} stopOpacity={1} />
                <Stop offset="0.5" stopColor={GOLD} stopOpacity={0.42} />
                <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle
              cx={GLOW_RADIUS}
              cy={GLOW_RADIUS}
              r={GLOW_RADIUS}
              fill="url(#splashGlow)"
            />
          </Svg>
        </Animated.View>
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
    width: GLOW_RADIUS * 2,
    height: GLOW_RADIUS * 2,
  },
});

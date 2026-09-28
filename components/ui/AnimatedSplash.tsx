import React, { memo, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
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
import { ScreenBackdrop } from "./ScreenBackdrop";
import { RippleCell, rippleRings } from "../../utils/splashRipple";

/**
 * AnimatedSplash — the launch moment: "Four directions", then the crossword
 * ripple.
 *
 * 1. Build-up: the gold centre pops in and the four arms shoot out one at a
 *    time (up, right, down, left: the four ways a Cruxe answer can run).
 * 2. Ripple: the page background fades in (the same light and dot grid as
 *    every other screen), and a crossword grid spreads outward from the logo,
 *    its cells rising ring by ring to a faint gold glow, out to the edges of
 *    the screen. It stays subtle throughout: there is no bright flash.
 * 3. The whole thing fades into the app.
 *
 * Where the build-up plays:
 * - Android 12+: the system plays it from the moment the icon is tapped
 *   (plugins/withAnimatedSplash.js). This picks up on its final frame, the
 *   complete logo at the same size and position, and plays the ripple, which
 *   needs the whole screen that the system splash cannot draw on.
 * - iOS and older Android: launch screens there cannot animate (Apple requires
 *   them static), so the native splash is the dark background alone and this
 *   plays the build-up too.
 *
 * If the app is still loading once the ripple has spread, the logo and the
 * settled grid stay on screen until `ready`, so the fade never reveals a blank
 * screen. With reduced motion on, the finished logo is shown still.
 *
 * Logo geometry must match plugins/withAnimatedSplash.js (a test checks this).
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

/**
 * The ripple: one ring of cells after another, every RING_STEP_MS, rises to a
 * faint glow. There is no bright flash first: the grid only ever reaches this
 * subtle level, over the dim backdrop.
 */
const RING_STEP_MS = 70;
const RING_RISE_MS = 520;
/** How visible a ring's cells get. Dim on purpose: a quiet wash, not a flash. */
const RING_REST = 0.16;
const BACKDROP_IN_MS = 420;
/** Hold the finished grid this long after the last ring has risen. */
const HOLD_BEFORE_FADE_MS = 200;
/** The exit: the logo and grid ease out, then the background dissolves. */
const CONTENT_OUT_MS = 280;
const FADE_MS = 420;

/**
 * On Android 12+ the app can be ready before the system's build-up has
 * finished. Keeping the native splash up this much longer after the overlay
 * appears lets it land on its final frame, rather than being cut short.
 */
const NATIVE_FINISH_MS = 500;

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
  const { width, height } = useWindowDimensions();
  const rings = useMemo(
    () => rippleRings(width, height, CELL, STEP),
    [width, height],
  );

  const buildHere = !NATIVE_INTRO && !reduceMotion;
  // The grid is mounted after the first frame, which has to be quick: it is
  // what lets the native splash hide.
  const [showGrid, setShowGrid] = useState(false);
  const [played, setPlayed] = useState(reduceMotion);

  const start = buildHere ? 0 : 1;
  const arms = [
    useSharedValue(start),
    useSharedValue(start),
    useSharedValue(start),
    useSharedValue(start),
  ];
  const core = useSharedValue(start);
  const backdrop = useSharedValue(0);
  // Enough ring values for the tallest screen; unused ones stay at 0.
  const ringValues = Array.from({ length: 24 }, () => useSharedValue(0));
  const content = useSharedValue(1);
  const fade = useSharedValue(1);

  // 1. The build-up, where the system did not already play it. Runs once.
  useEffect(() => {
    if (!buildHere) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. The ripple, once the grid is mounted.
  useEffect(() => {
    if (!showGrid || reduceMotion) return;
    const at = buildHere ? BUILD_MS - 60 : 0;

    backdrop.value = withDelay(
      at,
      withTiming(1, { duration: BACKDROP_IN_MS, easing: Easing.out(Easing.quad) }),
    );
    rings.forEach((_, k) => {
      if (k >= ringValues.length) return;
      ringValues[k].value = withDelay(
        at + k * RING_STEP_MS,
        withTiming(RING_REST, {
          duration: RING_RISE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      );
    });

    const spread = Math.min(rings.length, ringValues.length) * RING_STEP_MS;
    const timer = setTimeout(
      () => setPlayed(true),
      at + spread + RING_RISE_MS + HOLD_BEFORE_FADE_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGrid]);

  // 3. Into the app, once the ripple is well under way and the app is ready.
  useEffect(() => {
    if (!played || !ready) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    content.value = withTiming(0, {
      duration: CONTENT_OUT_MS,
      easing: Easing.in(Easing.quad),
    });
    fade.value = withDelay(
      CONTENT_OUT_MS - 80,
      withTiming(
        0,
        { duration: FADE_MS, easing: Easing.inOut(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played, ready]);

  const handleLayout = () => {
    if (NATIVE_INTRO) {
      // Let the system's build-up land, then hand over and start the ripple.
      setTimeout(() => {
        onVisible();
        setShowGrid(true);
      }, NATIVE_FINISH_MS);
    } else {
      onVisible();
      setShowGrid(true);
    }
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ scale: 1 + (1 - content.value) * 0.04 }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: core.value > 0.02 ? 1 : 0,
    transform: [{ scale: core.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      onLayout={handleLayout}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {showGrid && !reduceMotion ? (
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <ScreenBackdrop variant="splash" />
        </Animated.View>
      ) : null}

      {/* The logo and the grid leave first, then the background dissolves
          into the app, so neither is ever seen over the app's own content. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.centred, contentStyle]}
      >
        {showGrid && !reduceMotion
          ? rings
              .slice(0, ringValues.length)
              .map((cells, k) => (
                <Ring key={k} cells={cells} value={ringValues[k]} />
              ))
          : null}
        <View style={styles.logo}>
          {ARMS.map((arm, i) => (
            <Arm key={arm.key} progress={arms[i]} x={arm.x} y={arm.y} />
          ))}
          <Animated.View style={[styles.cell, styles.core, coreStyle]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** One ring of the ripple: its cells share a single animated opacity. */
const Ring = memo(function Ring({
  cells,
  value,
}: {
  cells: RippleCell[];
  value: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({ opacity: value.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      {cells.map((cell) => (
        <View
          key={cell.key}
          style={[styles.rippleCell, { left: cell.left, top: cell.top }]}
        />
      ))}
    </Animated.View>
  );
});

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
  centred: {
    alignItems: "center",
    justifyContent: "center",
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
  rippleCell: {
    position: "absolute",
    width: CELL,
    height: CELL,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: "rgba(238,205,43,0.85)",
    backgroundColor: "rgba(238,205,43,0.22)",
  },
});

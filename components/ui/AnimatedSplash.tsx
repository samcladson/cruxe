import React, { memo, useEffect, useState } from "react";
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
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { ScreenBackdrop } from "./ScreenBackdrop";

/**
 * AnimatedSplash — the launch moment: "Four directions", then a ripple of
 * light across the Home page's own background.
 *
 * 1. Build-up: the gold centre pops in and the four arms shoot out one at a
 *    time (up, right, down, left: the four ways a Cruxe answer can run).
 * 2. Ripple: Home's backdrop (its soft light and dot-grid particles) fades in,
 *    and soft rings of gold light spread from the logo across it and past the
 *    edges of the screen, with a faint glow lingering at the centre. Kept dim
 *    on purpose: a quiet wash over the particles, not a flash.
 * 3. The splash fades out. Home sits on the very same backdrop, so only its
 *    content appears to arrive.
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
 * If the app is still loading once the ripple has passed, the logo stays on
 * its backdrop until `ready`, so the fade never reveals a blank screen. With
 * reduced motion on, the finished logo is shown still.
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

/** The ripple: rings of light, one after another. */
const RING_COUNT = 3;
const RING_STAGGER_MS = 240;
const RING_MS = 1400;
/** A ring's brightest moment. Dim on purpose: a wash, not a flash. */
const RING_PEAK = 0.32;
/** The faint glow that lingers at the centre while the rings travel. */
const CENTRE_GLOW_PEAK = 0.18;
const BACKDROP_IN_MS = 360;
/**
 * The ring is drawn once at this radius and scaled up on the GPU, so a
 * screen-filling ripple costs no redraws. Its soft edge widens as it grows,
 * which is how a ripple spreads anyway.
 */
const RING_DRAWN_RADIUS = 200;
/** Fade into the app once the last ring is this far across the screen. */
const FADE_AT_SHARE = 0.6;
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
  // Far enough to leave the screen by every corner.
  const reach = Math.hypot(width, height) / 2 + STEP;

  const buildHere = !NATIVE_INTRO && !reduceMotion;
  // The ripple layers mount after the first frame, which has to be quick: it
  // is what lets the native splash hide.
  const [rippling, setRippling] = useState(false);
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
  const centreGlow = useSharedValue(0);
  const rings = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
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

  // 2. The ripple across Home's backdrop.
  useEffect(() => {
    if (!rippling || reduceMotion) return;
    const at = buildHere ? BUILD_MS - 80 : 0;
    const ease = Easing.out(Easing.cubic);

    backdrop.value = withDelay(
      at,
      withTiming(1, { duration: BACKDROP_IN_MS, easing: ease }),
    );
    centreGlow.value = withDelay(
      at,
      withTiming(1, { duration: RING_MS / 2, easing: ease }),
    );
    rings.forEach((ring, i) => {
      ring.value = withDelay(
        at + i * RING_STAGGER_MS,
        withTiming(1, { duration: RING_MS, easing: ease }),
      );
    });

    const lastRingAt = at + (RING_COUNT - 1) * RING_STAGGER_MS;
    const timer = setTimeout(
      () => setPlayed(true),
      lastRingAt + RING_MS * FADE_AT_SHARE,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rippling]);

  // 3. Into the app, once the ripple is well across and the app is ready.
  useEffect(() => {
    if (!played || !ready) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    fade.value = withTiming(
      0,
      { duration: FADE_MS, easing: Easing.inOut(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played, ready]);

  const handleLayout = () => {
    if (NATIVE_INTRO) {
      // Let the system's build-up land, then hand over and start the ripple.
      setTimeout(() => {
        onVisible();
        setRippling(true);
      }, NATIVE_FINISH_MS);
    } else {
      onVisible();
      setRippling(true);
    }
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const centreGlowStyle = useAnimatedStyle(() => ({
    opacity: centreGlow.value * CENTRE_GLOW_PEAK,
    transform: [{ scale: 0.6 + 0.4 * centreGlow.value }],
  }));
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
      {rippling && !reduceMotion ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <ScreenBackdrop variant="home" />
          </Animated.View>
          <Animated.View style={[styles.centred, centreGlowStyle]}>
            <SoftLight radius={STEP * 3} id="splashCentreGlow" />
          </Animated.View>
          {rings.map((ring, i) => (
            <RippleRing key={i} progress={ring} reach={reach} index={i} />
          ))}
        </>
      ) : null}

      <View style={styles.logo}>
        {ARMS.map((arm, i) => (
          <Arm key={arm.key} progress={arms[i]} x={arm.x} y={arm.y} />
        ))}
        <Animated.View style={[styles.cell, styles.core, coreStyle]} />
      </View>
    </Animated.View>
  );
}

/** A soft gold radial glow, brightest at the centre. */
function SoftLight({ radius, id }: { radius: number; id: string }) {
  return (
    <Svg width={radius * 2} height={radius * 2}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={GOLD} stopOpacity={1} />
          <Stop offset="0.5" stopColor={GOLD} stopOpacity={0.35} />
          <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={radius} cy={radius} r={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * One ring of the ripple: a soft band of gold light, drawn once and scaled
 * outward from the logo, brightening quickly and fading as it spreads.
 */
const RippleRing = memo(function RippleRing({
  progress,
  reach,
  index,
}: {
  progress: SharedValue<number>;
  reach: number;
  index: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Up to full strength over the first sixth, then away as it travels.
    const strength = p < 0.16 ? p / 0.16 : 1 - (p - 0.16) / 0.84;
    return {
      opacity: p <= 0 ? 0 : RING_PEAK * strength * (1 - index * 0.18),
      transform: [{ scale: ((0.12 + 0.88 * p) * reach) / RING_DRAWN_RADIUS }],
    };
  });
  const r = RING_DRAWN_RADIUS;
  const id = `splashRipple${index}`;
  return (
    <Animated.View style={[styles.centred, style]}>
      <Svg width={r * 2} height={r * 2}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={GOLD} stopOpacity={0} />
            <Stop offset="0.6" stopColor={GOLD} stopOpacity={0.05} />
            <Stop offset="0.86" stopColor={GOLD} stopOpacity={1} />
            <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
      </Svg>
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
  // Centred on the logo; the overlay itself centres its children.
  centred: {
    position: "absolute",
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
});

/**
 * withAnimatedSplash — the "Four directions" logo animation, played by Android
 * itself from the moment the app icon is tapped (Android 12+).
 *
 * Android 12 introduced an animated splash icon: an animated vector drawable
 * the system plays before any app code runs. This writes one that builds the
 * Cruxe logo: the gold centre pops in, the four arms shoot out one at a time
 * (up, right, down, left), then a soft gold glow swells and fades behind it.
 * It ends on the complete logo, which components/ui/AnimatedSplash.tsx then
 * shows at exactly the same size and position before fading into the app.
 *
 * It does not touch `windowSplashScreenAnimatedIcon`, which expo-splash-screen
 * owns. Instead it adds a second `splashscreen_logo` in `drawable-anydpi-v31`:
 * Android prefers an `anydpi` resource over the density-specific PNGs that
 * expo-splash-screen writes, so Android 12+ gets this animation and older
 * versions keep the PNG (a blank image, since the in-app animation covers
 * them). iOS has no equivalent: Apple requires launch screens to be static.
 *
 * Geometry and timing must match AnimatedSplash.tsx (a test checks this).
 */
const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withAndroidStyles,
  withDangerousMod,
} = require("expo/config-plugins");

// The splash icon canvas: 288dp square, of which a 192dp circle is shown.
const SIZE = 288;
const MID = SIZE / 2;

const CELL = 40;
const GAP = 6;
const STEP = CELL + GAP;
const RADIUS = 10;
const STROKE = 2.5;

const GOLD = "#FFEECD2B";
const ARM_FILL = "#FF111111";

/**
 * The arms are kept until after Android's app-opening zoom (roughly the first
 * 400ms), which would otherwise play over them and hide the motion. The last
 * arm lands at 400 + 3 * 120 + 240 = 1000ms.
 */
const CORE_AT = 100;
const CORE_POP_MS = 200;
const CORE_SETTLE_MS = 180;
const FIRST_ARM_AT = 400;
const ARM_STAGGER = 120;
const ARM_MS = 240;
const BUILD_MS = FIRST_ARM_AT + 3 * ARM_STAGGER + ARM_MS;

/**
 * The glow swells behind the finished logo, then fades. Android only promises
 * to show a 96dp-radius circle of the icon, and some phones clip it to their
 * own icon shape just outside that: a glow reaching past it shows a hard edge.
 * So its widest point, at full swell, stays inside 90dp.
 */
const GLOW_AT = BUILD_MS - 40;
const GLOW_IN_MS = 140;
const GLOW_OUT_MS = 260;
const GLOW_RADIUS = 75;
const GLOW_MAX_SCALE = 1.2;
const GLOW_PEAK = 0.4;

/**
 * Android 12 reads the animation's length from the theme, and caps it at
 * 1000ms; the glow runs a little past that. Android 13+ takes the length from
 * the drawable itself.
 */
const THEME_DURATION_MS = 1000;
const TOTAL_MS = GLOW_AT + GLOW_IN_MS + GLOW_OUT_MS;

/** A rounded rectangle as vector path data. */
function roundRect(x, y, w, h, r) {
  const f = (n) => Number(n.toFixed(3));
  return [
    `M${f(x + r)},${f(y)}`,
    `H${f(x + w - r)}`,
    `A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)}`,
    `V${f(y + h - r)}`,
    `A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)}`,
    `H${f(x + r)}`,
    `A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)}`,
    `V${f(y + r)}`,
    `A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)}`,
    "Z",
  ].join(" ");
}

/** A cell centred on (cx, cy). Arms are stroked inside their box, as in RN. */
function cellPath(cx, cy, stroked) {
  const inset = stroked ? STROKE / 2 : 0;
  return roundRect(
    cx - CELL / 2 + inset,
    cy - CELL / 2 + inset,
    CELL - inset * 2,
    CELL - inset * 2,
    RADIUS - inset,
  );
}

/** A circle centred on the canvas, as vector path data. */
function circlePath(r) {
  return `M${MID - r},${MID} A${r},${r} 0 1 1 ${MID + r},${MID} A${r},${r} 0 1 1 ${MID - r},${MID} Z`;
}

const ARMS = [
  { name: "arm_up", dx: 0, dy: -STEP },
  { name: "arm_right", dx: STEP, dy: 0 },
  { name: "arm_down", dx: 0, dy: STEP },
  { name: "arm_left", dx: -STEP, dy: 0 },
];

function animator(prop, from, to, { at = 0, ms, interpolator } = {}) {
  return `
          <objectAnimator android:propertyName="${prop}"
              android:valueFrom="${from}" android:valueTo="${to}"
              android:valueType="floatType"
              android:startOffset="${at}" android:duration="${ms}"${
                interpolator
                  ? `
              android:interpolator="@android:anim/${interpolator}"`
                  : ""
              } />`;
}

function target(name, animators) {
  return `
  <target android:name="${name}">
    <aapt:attr name="android:animation">
      <set>${animators}
      </set>
    </aapt:attr>
  </target>`;
}

function buildDrawable() {
  // Soft glow: a gold radial gradient, invisible and small until it swells.
  const glowGroup = `
      <group android:name="glow"
          android:pivotX="${MID}" android:pivotY="${MID}"
          android:scaleX="0.7" android:scaleY="0.7">
        <path android:name="glow_path"
            android:pathData="${circlePath(GLOW_RADIUS)}"
            android:fillAlpha="0">
          <aapt:attr name="android:fillColor">
            <gradient android:type="radial"
                android:centerX="${MID}" android:centerY="${MID}"
                android:gradientRadius="${GLOW_RADIUS}"
                android:startColor="#FFEECD2B"
                android:centerColor="#6BEECD2B"
                android:endColor="#00EECD2B" />
          </aapt:attr>
        </path>
      </group>`;

  // Each arm is drawn in place and starts translated back to the centre,
  // half size and invisible, so the core covers it until it fires.
  const armGroups = ARMS.map(
    ({ name, dx, dy }) => `
      <group android:name="${name}"
          android:pivotX="${MID + dx}" android:pivotY="${MID + dy}"
          android:translateX="${-dx}" android:translateY="${-dy}"
          android:scaleX="0.5" android:scaleY="0.5">
        <path android:name="${name}_path"
            android:pathData="${cellPath(MID + dx, MID + dy, true)}"
            android:fillColor="${ARM_FILL}"
            android:strokeColor="${GOLD}"
            android:strokeWidth="${STROKE}"
            android:fillAlpha="0"
            android:strokeAlpha="0" />
      </group>`,
  ).join("");

  const armTargets = ARMS.map(({ name, dx, dy }, i) => {
    const at = FIRST_ARM_AT + i * ARM_STAGGER;
    const shoot = { at, ms: ARM_MS, interpolator: "overshoot_interpolator" };
    return (
      target(
        name,
        animator("translateX", -dx, 0, shoot) +
          animator("translateY", -dy, 0, shoot) +
          animator("scaleX", 0.5, 1, shoot) +
          animator("scaleY", 0.5, 1, shoot),
      ) +
      target(
        `${name}_path`,
        animator("fillAlpha", 0, 1, { at, ms: 1 }) +
          animator("strokeAlpha", 0, 1, { at, ms: 1 }),
      )
    );
  }).join("");

  const corePop = (prop) => `
          <set android:ordering="sequentially">${animator(prop, 0, 1.16, {
            at: CORE_AT,
            ms: CORE_POP_MS,
            interpolator: "decelerate_interpolator",
          })}${animator(prop, 1.16, 1, {
            ms: CORE_SETTLE_MS,
            interpolator: "overshoot_interpolator",
          })}
          </set>`;

  const glowSwell = (prop) => `
          <set android:ordering="sequentially">${animator(prop, 0.7, 1.05, {
            at: GLOW_AT,
            ms: GLOW_IN_MS,
            interpolator: "decelerate_interpolator",
          })}${animator(prop, 1.05, GLOW_MAX_SCALE, { ms: GLOW_OUT_MS })}
          </set>`;

  const glowFade = `
          <set android:ordering="sequentially">${animator("fillAlpha", 0, GLOW_PEAK, {
            at: GLOW_AT,
            ms: GLOW_IN_MS,
          })}${animator("fillAlpha", GLOW_PEAK, 0, {
            ms: GLOW_OUT_MS,
            interpolator: "accelerate_interpolator",
          })}
          </set>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by plugins/withAnimatedSplash.js. Do not edit by hand. -->
<animated-vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt">
  <aapt:attr name="android:drawable">
    <vector android:width="${SIZE}dp" android:height="${SIZE}dp"
        android:viewportWidth="${SIZE}" android:viewportHeight="${SIZE}">${glowGroup}${armGroups}
      <group android:name="core"
          android:pivotX="${MID}" android:pivotY="${MID}"
          android:scaleX="0" android:scaleY="0">
        <path android:pathData="${cellPath(MID, MID, false)}"
            android:fillColor="${GOLD}" />
      </group>
    </vector>
  </aapt:attr>${target("core", corePop("scaleX") + corePop("scaleY"))}${armTargets}${target(
    "glow",
    glowSwell("scaleX") + glowSwell("scaleY"),
  )}${target("glow_path", glowFade)}
</animated-vector>
`;
}

function withAnimatedSplash(config) {
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const dir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/drawable-anydpi-v31",
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "splashscreen_logo.xml"), buildDrawable());
      return config;
    },
  ]);

  // expo-splash-screen does not set this item, so the two cannot conflict.
  config = withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(
      config.modResults,
      {
        add: true,
        parent: { name: "Theme.App.SplashScreen", parent: "Theme.SplashScreen" },
        name: "windowSplashScreenAnimationDuration",
        value: String(THEME_DURATION_MS),
      },
    );
    return config;
  });

  return config;
}

module.exports = withAnimatedSplash;
module.exports.buildDrawable = buildDrawable;
module.exports.GEOMETRY = {
  SIZE,
  CELL,
  GAP,
  RADIUS,
  STROKE,
  GLOW_RADIUS,
  GLOW_MAX_SCALE,
  THEME_DURATION_MS,
  TOTAL_MS,
};

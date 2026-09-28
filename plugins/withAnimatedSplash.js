/**
 * withAnimatedSplash — the "Four directions" logo animation, played by Android
 * itself from the moment the app icon is tapped (Android 12+).
 *
 * Android 12 introduced an animated splash icon: an animated vector drawable
 * the system plays before any app code runs. This writes one that builds the
 * Cruxe logo: the gold centre pops in, then the four arms shoot out up, right,
 * down and left. It ends on the complete logo, which components/ui/
 * AnimatedSplash.tsx then shows at exactly the same size and position before
 * fading into the app.
 *
 * It does not touch `windowSplashScreenAnimatedIcon`, which expo-splash-screen
 * owns. Instead it adds a second `splashscreen_logo` in `drawable-anydpi-v31`:
 * Android prefers an `anydpi` resource over the density-specific PNGs that
 * expo-splash-screen writes, so Android 12+ gets this animation and older
 * versions keep the PNG (a blank image, since the in-app animation covers
 * them). iOS has no equivalent: Apple requires launch screens to be static.
 *
 * Geometry must match AnimatedSplash.tsx (CELL, GAP, radius, stroke).
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

/** Last arm lands at 500 + 300 = 800ms: inside Android's 1000ms limit. */
const DURATION_MS = 800;
const CORE_POP_MS = 170;
const CORE_SETTLE_MS = 180;
const FIRST_ARM_AT = 200;
const ARM_STAGGER = 100;
const ARM_MS = 300;

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

const ARMS = [
  { name: "arm_up", dx: 0, dy: -STEP },
  { name: "arm_right", dx: STEP, dy: 0 },
  { name: "arm_down", dx: 0, dy: STEP },
  { name: "arm_left", dx: -STEP, dy: 0 },
];

function buildDrawable() {
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
    const move = (prop, from) => `
          <objectAnimator android:propertyName="${prop}"
              android:valueFrom="${from}" android:valueTo="0"
              android:valueType="floatType"
              android:startOffset="${at}" android:duration="${ARM_MS}"
              android:interpolator="@android:anim/overshoot_interpolator" />`;
    const grow = (prop) => `
          <objectAnimator android:propertyName="${prop}"
              android:valueFrom="0.5" android:valueTo="1"
              android:valueType="floatType"
              android:startOffset="${at}" android:duration="${ARM_MS}"
              android:interpolator="@android:anim/overshoot_interpolator" />`;
    const show = (prop) => `
          <objectAnimator android:propertyName="${prop}"
              android:valueFrom="0" android:valueTo="1"
              android:valueType="floatType"
              android:startOffset="${at}" android:duration="1" />`;
    return `
  <target android:name="${name}">
    <aapt:attr name="android:animation">
      <set>${move("translateX", -dx)}${move("translateY", -dy)}${grow("scaleX")}${grow("scaleY")}
      </set>
    </aapt:attr>
  </target>
  <target android:name="${name}_path">
    <aapt:attr name="android:animation">
      <set>${show("fillAlpha")}${show("strokeAlpha")}
      </set>
    </aapt:attr>
  </target>`;
  }).join("");

  const corePop = (prop) => `
          <set android:ordering="sequentially">
            <objectAnimator android:propertyName="${prop}"
                android:valueFrom="0" android:valueTo="1.16"
                android:valueType="floatType"
                android:duration="${CORE_POP_MS}"
                android:interpolator="@android:anim/decelerate_interpolator" />
            <objectAnimator android:propertyName="${prop}"
                android:valueFrom="1.16" android:valueTo="1"
                android:valueType="floatType"
                android:duration="${CORE_SETTLE_MS}"
                android:interpolator="@android:anim/overshoot_interpolator" />
          </set>`;

  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by plugins/withAnimatedSplash.js. Do not edit by hand. -->
<animated-vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt">
  <aapt:attr name="android:drawable">
    <vector android:width="${SIZE}dp" android:height="${SIZE}dp"
        android:viewportWidth="${SIZE}" android:viewportHeight="${SIZE}">${armGroups}
      <group android:name="core"
          android:pivotX="${MID}" android:pivotY="${MID}"
          android:scaleX="0" android:scaleY="0">
        <path android:pathData="${cellPath(MID, MID, false)}"
            android:fillColor="${GOLD}" />
      </group>
    </vector>
  </aapt:attr>
  <target android:name="core">
    <aapt:attr name="android:animation">
      <set>${corePop("scaleX")}${corePop("scaleY")}
      </set>
    </aapt:attr>
  </target>${armTargets}
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

  // Android 12 reads the animation's length from the theme; 13+ from the
  // drawable itself. expo-splash-screen does not set this item.
  config = withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(
      config.modResults,
      {
        add: true,
        parent: { name: "Theme.App.SplashScreen", parent: "Theme.SplashScreen" },
        name: "windowSplashScreenAnimationDuration",
        value: String(DURATION_MS),
      },
    );
    return config;
  });

  return config;
}

module.exports = withAnimatedSplash;
module.exports.buildDrawable = buildDrawable;
module.exports.GEOMETRY = { SIZE, CELL, GAP, RADIUS, STROKE, DURATION_MS };

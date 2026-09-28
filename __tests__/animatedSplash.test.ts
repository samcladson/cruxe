/**
 * The launch animation. On Android 12+ the system plays the logo build-up and
 * the in-app overlay takes over on its final frame, so their logo geometry
 * must match or the logo jumps at the handover. The overlay then plays the
 * crossword ripple across the screen.
 */
import * as fs from "fs";
import * as path from "path";
import { rippleRings } from "../utils/splashRipple";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require("../plugins/withAnimatedSplash");

const overlaySource = fs.readFileSync(
  path.join(__dirname, "../components/ui/AnimatedSplash.tsx"),
  "utf8",
);
const constant = (name: string) =>
  Number(
    overlaySource
      .split("\n")
      .find((line) => line.startsWith(`const ${name} = `))
      ?.replace(`const ${name} = `, "")
      .replace(";", ""),
  );

describe("native splash drawable", () => {
  it("draws the same logo as the in-app overlay", () => {
    const g = plugin.GEOMETRY;
    expect(constant("CELL")).toBe(g.CELL);
    expect(constant("GAP")).toBe(g.GAP);
    expect(constant("RADIUS")).toBe(g.RADIUS);
    expect(constant("STROKE")).toBe(g.STROKE);
  });

  it("draws only the logo: no glow, which the system clips into a box", () => {
    const xml: string = plugin.buildDrawable();
    expect(xml).not.toContain("gradient");
    const targets = [...xml.matchAll(/<target android:name="([^"]+)"/g)].map((m) => m[1]);
    // core + 4 arm groups + 4 arm paths
    expect(targets).toHaveLength(9);
    for (const t of targets) expect(xml).toContain(`android:name="${t}"\n`);
  });

  it("fits the part of the splash icon Android shows (a 192dp circle)", () => {
    const { CELL, GAP } = plugin.GEOMETRY;
    expect(Math.hypot(1.5 * CELL + GAP, CELL / 2)).toBeLessThanOrEqual(96);
  });

  it("stays within Android 12's 1000ms limit", () => {
    expect(plugin.GEOMETRY.THEME_DURATION_MS).toBeLessThanOrEqual(1000);
  });

  it("plays once and stops: nothing loops", () => {
    expect(plugin.buildDrawable()).not.toContain("repeatCount");
    expect(overlaySource).not.toContain("withRepeat");
  });

  it("is balanced XML", () => {
    const xml: string = plugin.buildDrawable();
    const open = (xml.match(/<(set|group|path|target|vector|animated-vector|aapt:attr|objectAnimator)\b/g) ?? []).length;
    const selfClosed = (xml.match(/\/>/g) ?? []).length;
    const closed = (xml.match(/<\/(set|group|path|target|vector|animated-vector|aapt:attr)>/g) ?? []).length;
    expect(open).toBe(selfClosed + closed);
  });
});

describe("crossword ripple", () => {
  const CELL = 40;
  const STEP = 46;
  // A tall phone: 390 x 844 points.
  const rings = rippleRings(390, 844, CELL, STEP);
  const all = rings.flat();

  it("leaves the logo's own five cells alone", () => {
    for (const key of ["0,0", "0,-1", "1,0", "0,1", "-1,0"]) {
      expect(all.find((c) => c.key === key)).toBeUndefined();
    }
  });

  it("covers the whole screen, edge to edge", () => {
    expect(Math.min(...all.map((c) => c.left))).toBeLessThanOrEqual(0);
    expect(Math.min(...all.map((c) => c.top))).toBeLessThanOrEqual(0);
    expect(Math.max(...all.map((c) => c.left + CELL))).toBeGreaterThanOrEqual(390);
    expect(Math.max(...all.map((c) => c.top + CELL))).toBeGreaterThanOrEqual(844);
  });

  it("is aligned to the logo's grid", () => {
    const centreLeft = 390 / 2 - CELL / 2;
    for (const c of all) {
      expect(Math.abs(((c.left - centreLeft) / STEP) % 1)).toBeCloseTo(0, 6);
    }
  });

  it("spreads outward: every ring is farther from the logo than the last", () => {
    const dist = (ring: typeof all) =>
      Math.min(...ring.map((c) => Math.hypot(c.left + CELL / 2 - 195, c.top + CELL / 2 - 422)));
    for (let k = 1; k < rings.length; k++) {
      expect(dist(rings[k])).toBeGreaterThan(dist(rings[k - 1]));
    }
  });

  it("fits within the overlay's ring layers on the tallest phones", () => {
    // AnimatedSplash animates up to 24 rings; a 430 x 932 phone needs fewer.
    expect(rippleRings(430, 932, CELL, STEP).length).toBeLessThanOrEqual(24);
  });
});

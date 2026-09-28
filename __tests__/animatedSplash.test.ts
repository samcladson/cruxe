/**
 * The Android 12+ splash plays the logo animation natively, then the in-app
 * overlay takes over on its final frame. If their geometry ever differs, the
 * logo visibly jumps at that handover, so the two are pinned together here.
 */
import * as fs from "fs";
import * as path from "path";

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

describe("animated splash", () => {
  it("draws the same logo natively and in the app", () => {
    const g = plugin.GEOMETRY;
    expect(constant("CELL")).toBe(g.CELL);
    expect(constant("GAP")).toBe(g.GAP);
    expect(constant("RADIUS")).toBe(g.RADIUS);
    expect(constant("STROKE")).toBe(g.STROKE);
  });

  it("draws the same glow natively and in the app", () => {
    expect(constant("GLOW_RADIUS")).toBe(plugin.GEOMETRY.GLOW_RADIUS);
  });

  it("keeps the glow inside what the Android splash can show", () => {
    // A glow reaching the icon's mask shows a hard edge (seen on a OnePlus).
    const { GLOW_RADIUS, GLOW_MAX_SCALE } = plugin.GEOMETRY;
    expect(GLOW_RADIUS * GLOW_MAX_SCALE).toBeLessThanOrEqual(90);
  });

  it("plays once and stops: nothing loops", () => {
    expect(plugin.buildDrawable()).not.toContain("repeatCount");
    expect(overlaySource).not.toContain("withRepeat");
  });

  it("glows only after the last arm has landed", () => {
    const xml: string = plugin.buildDrawable();
    const armEnds = [...xml.matchAll(/android:startOffset="(\d+)" android:duration="240"/g)].map(
      (m) => Number(m[1]) + 240,
    );
    const glowStarts = [
      ...xml.matchAll(/android:startOffset="(\d+)" android:duration="140"/g),
    ].map((m) => Number(m[1]));
    expect(glowStarts.length).toBeGreaterThan(0);
    expect(Math.min(...glowStarts)).toBeGreaterThanOrEqual(Math.max(...armEnds) - 40);
  });

  it("fits the part of the splash icon Android shows (a 192dp circle)", () => {
    const { CELL, GAP } = plugin.GEOMETRY;
    const farthestCorner = Math.hypot(1.5 * CELL + GAP, CELL / 2);
    expect(farthestCorner).toBeLessThanOrEqual(96);
  });

  it("keeps the theme duration within Android 12's 1000ms cap", () => {
    expect(plugin.GEOMETRY.THEME_DURATION_MS).toBeLessThanOrEqual(1000);
    // The whole animation, glow included, stays well short of a slow launch.
    expect(plugin.GEOMETRY.TOTAL_MS).toBeLessThanOrEqual(1500);
  });

  it("names every animated node it targets", () => {
    const xml: string = plugin.buildDrawable();
    const targets = [...xml.matchAll(/<target android:name="([^"]+)"/g)].map((m) => m[1]);
    // core + 4 arm groups + 4 arm paths + glow group + glow path
    expect(targets).toHaveLength(11);
    for (const t of targets) expect(xml).toContain(`android:name="${t}"\n`);
  });

  it("is balanced XML", () => {
    const xml: string = plugin.buildDrawable();
    const open = (xml.match(/<(set|group|path|target|vector|animated-vector|aapt:attr|objectAnimator|gradient)\b/g) ?? []).length;
    const selfClosed = (xml.match(/\/>/g) ?? []).length;
    const closed = (xml.match(/<\/(set|group|path|target|vector|animated-vector|aapt:attr)>/g) ?? []).length;
    expect(open).toBe(selfClosed + closed);
  });
});

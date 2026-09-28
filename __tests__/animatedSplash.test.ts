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

  it("fits the part of the splash icon Android shows (a 192dp circle)", () => {
    const { CELL, GAP } = plugin.GEOMETRY;
    const farthestCorner = Math.hypot(1.5 * CELL + GAP, CELL / 2);
    expect(farthestCorner).toBeLessThanOrEqual(96);
  });

  it("stays within Android's 1000ms limit for splash animations", () => {
    expect(plugin.GEOMETRY.DURATION_MS).toBeLessThanOrEqual(1000);
  });

  it("names every animated node it targets", () => {
    const xml: string = plugin.buildDrawable();
    const targets = [...xml.matchAll(/<target android:name="([^"]+)"/g)].map((m) => m[1]);
    expect(targets).toHaveLength(9); // core + 4 arm groups + 4 arm paths
    for (const t of targets) expect(xml).toContain(`android:name="${t}"\n`);
  });

  it("is balanced XML", () => {
    const xml: string = plugin.buildDrawable();
    const open = (xml.match(/<(set|group|path|target|vector|animated-vector|aapt:attr|objectAnimator)\b/g) ?? []).length;
    const selfClosed = (xml.match(/\/>/g) ?? []).length;
    const closed = (xml.match(/<\/(set|group|target|vector|animated-vector|aapt:attr)>/g) ?? []).length;
    expect(open).toBe(selfClosed + closed);
  });
});

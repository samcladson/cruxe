/**
 * Generates Cruxe's brand assets: the app icon family, store graphics and the
 * per-screen background illustrations ("backdrops").
 *
 * One motif runs through all of it — two words crossing on a shared, gold
 * square (a crux). It appears in two treatments:
 *
 *   Gold field   — black squares on gold, the crossing left as an empty
 *                  square to be solved. The launcher / store icon, where it
 *                  has to hold its own among other apps.
 *   Gold outline — gold-outlined arms around a solid gold crossing, on black.
 *                  The mark inside the app's own dark world: splash, feature
 *                  graphic, notification, alternate icon.
 *
 * Every backdrop is "ambient": a fine dot grid under soft light in the app's
 * colours, fogged before it reaches the content. Only where a motif earns its
 * place — the welcome screen — do answer blocks sit on the grid: straight
 * squares, gold where two answers cross.
 *
 * SVG is the source of truth; PNGs are rendered from it.
 *
 *   node scripts/brand/generate-brand.cjs
 *
 * Requires @resvg/resvg-js to be resolvable (devDependency, or NODE_PATH).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "assets/brand");
const FONT_DIR = path.join(ROOT, "node_modules/@expo-google-fonts/manrope");

// Palette — mirrors constants/theme.ts and constants/categories.ts.
const BG = "#0a0a0a";
const INK = "#f8f8f6";
const GOLD = "#eecd2b";
const GOLD_HI = "#f7de5a";
const GOLD_LO = "#d4b41c";
const MUTED = "#a3a3a3";
const BLUE = "#3b82f6";
const PURPLE = "#a855f7";
const GREEN = "#10b981";

const FONT_UI = "Manrope";

const r2 = (n) => Math.round(n * 100) / 100;
const clamp01 = (n) => Math.max(0, Math.min(1, n));

/* -------------------------------------------------------------------------- */
/*  Shared primitives                                                         */
/* -------------------------------------------------------------------------- */

let gradientSeq = 0;
const uid = () => `g${++gradientSeq}`;

function svgDoc(w, h, defs, body, { bg, slice } = {}) {
  const par = slice ? ` preserveAspectRatio="xMidYMid slice"` : "";
  const bgRect = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"${par}>` +
    (defs.length ? `<defs>${defs.join("")}</defs>` : "") +
    bgRect +
    body +
    `</svg>`
  );
}

/** A soft radial glow. Returns [def, element]. */
function glow(cx, cy, r, color, opacity) {
  const id = uid();
  return [
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>` +
      `<stop offset="0.45" stop-color="${color}" stop-opacity="${r2(opacity * 0.42)}"/>` +
      `<stop offset="1" stop-color="${color}" stop-opacity="0"/>` +
      `</radialGradient>`,
    `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="url(#${id})"/>`,
  ];
}

/**
 * Fog in the page colour: clear around the focus, opaque beyond r. Laid over
 * a pattern, it makes the pattern dissolve before it reaches the content.
 */
function fog(w, h, fx, fy, r, clear = 0.12) {
  const id = uid();
  return [
    `<radialGradient id="${id}" cx="${fx}" cy="${fy}" r="${r}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${BG}" stop-opacity="0"/>` +
      `<stop offset="${clear}" stop-color="${BG}" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="${BG}" stop-opacity="1"/></radialGradient>`,
    `<rect width="${w}" height="${h}" fill="url(#${id})"/>`,
  ];
}

/**
 * One crossword cell, centred on (cx, cy).
 *  kind: line  — hairline outline (an empty square of the grid)
 *        ghost — fainter outline
 *        fill  — a filled, answered square
 *        gold  — the accent square
 *        goldLine — accent outline only
 */
function cell(cx, cy, s, kind, o = 1, rot = 0) {
  if (o <= 0.02) return "";
  const x = r2(cx - s / 2);
  const y = r2(cy - s / 2);
  const rx = r2(s * 0.17);
  const t = rot ? ` transform="rotate(${r2(rot)} ${r2(cx)} ${r2(cy)})"` : "";
  let paint;
  switch (kind) {
    case "ghost":
      paint = `fill="none" stroke="${INK}" stroke-opacity="${r2(0.045 * o)}"`;
      break;
    case "fill":
      paint = `fill="${INK}" fill-opacity="${r2(0.03 * o)}" stroke="${INK}" stroke-opacity="${r2(0.085 * o)}"`;
      break;
    case "gold":
      paint = `fill="${GOLD}" fill-opacity="${r2(0.11 * o)}" stroke="${GOLD}" stroke-opacity="${r2(0.5 * o)}"`;
      break;
    case "goldLine":
      paint = `fill="none" stroke="${GOLD}" stroke-opacity="${r2(0.26 * o)}"`;
      break;
    default:
      paint = `fill="none" stroke="${INK}" stroke-opacity="${r2(0.085 * o)}"`;
  }
  return `<rect x="${x}" y="${y}" width="${r2(s)}" height="${r2(s)}" rx="${rx}" ${paint} stroke-width="1"${t}/>`;
}

/** Opacity falloff by distance from an anchor: 1 inside d0, 0 beyond d1. */
const falloff = (ax, ay, d0, d1) => (x, y) => 1 - clamp01((Math.hypot(x - ax, y - ay) - d0) / (d1 - d0));

/* -------------------------------------------------------------------------- */
/*  Backdrops — 390×844 canvas, rendered with preserveAspectRatio slice       */
/* -------------------------------------------------------------------------- */

const W = 390;
const H = 844;

/** Hairline grid, used by the feature graphic. */
function paperLines(w, h, pitch, o = 0.05) {
  let s = "";
  for (let x = 0; x <= w; x += pitch) s += `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`;
  for (let y = 0; y <= h; y += pitch) s += `<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
  return `<g stroke="${INK}" stroke-opacity="${o}" stroke-width="1">${s}</g>`;
}

const DOT_PITCH = 22;

/**
 * The dot grid as one repeating pattern rather than hundreds of circles — the
 * same picture, far cheaper for react-native-svg to draw. Returns [def, element].
 */
function dots(o = 0.11) {
  const id = uid();
  return [
    `<pattern id="${id}" width="${DOT_PITCH}" height="${DOT_PITCH}" patternUnits="userSpaceOnUse">` +
      `<circle cx="${DOT_PITCH / 2}" cy="${DOT_PITCH / 2}" r="1.1" fill="${INK}" fill-opacity="${o}"/></pattern>`,
    `<rect width="${W}" height="${H}" fill="url(#${id})"/>`,
  ];
}

/* Blocks ------------------------------------------------------------------ */
// Answer squares on a straight grid, two dot-pitches apart, so the gutters
// between squares fall exactly between rows of dots.

const BLOCK_PITCH = DOT_PITCH * 2;
const BLOCK_SIZE = 36;
const bx = (i) => DOT_PITCH + i * BLOCK_PITCH;

/** One square at block column c, row r. Solid squares hide the dots they sit on; outlines let them show. */
function block(c, r, kind, o) {
  if (o <= 0.03) return "";
  const x = bx(c) - BLOCK_SIZE / 2;
  const y = bx(r) - BLOCK_SIZE / 2;
  const solid = kind === "fill" || kind === "gold";
  const under = !solid ? "" : `<rect x="${x}" y="${y}" width="${BLOCK_SIZE}" height="${BLOCK_SIZE}" rx="${r2(BLOCK_SIZE * 0.17)}" fill="${BG}" fill-opacity="${r2(0.9 * o)}"/>`;
  return under + cell(bx(c), bx(r), BLOCK_SIZE, kind, Math.min(1.3, 1.3 * o));
}

/** An across and a down answer, gold where they cross, fading from the crossing. */
function answers(across, down, d0, d1) {
  const [ac, ar, alen] = across;
  const [dc, dr, dlen] = down;
  const fade = falloff(bx(dc), bx(ar), d0, d1);
  const cells = new Map();
  for (let k = 0; k < alen; k++) cells.set(`${ac + k},${ar}`, "fill");
  for (let k = 0; k < dlen; k++) cells.set(`${dc},${dr + k}`, "fill");
  cells.set(`${dc},${ar}`, "gold");
  let out = "";
  for (const [key, kind] of cells) {
    const [c, r] = key.split(",").map(Number);
    out += block(c, r, kind, kind === "gold" ? 1 : fade(bx(c), bx(r)));
  }
  return out;
}

/* Ambient ----------------------------------------------------------------- */

/**
 * Every backdrop is ambient: coloured light under a dot grid, fogged toward
 * the content. A few screens add blocks on top.
 *   lights: [cx, cy, r, color, opacity][]
 *   focus:  [fx, fy, r, clear] — where the dot grid stays visible
 */
function ambient({ lights, focus, blocks = "", dotOpacity = 0.11 }) {
  const defs = [];
  let body = "";
  for (const l of lights) {
    const [d, e] = glow(...l);
    defs.push(d);
    body += e;
  }
  const [dd, d] = dots(dotOpacity);
  const [fd, f] = fog(W, H, ...focus);
  defs.push(dd, fd);
  return { defs, body: body + d + f + blocks };
}

/** Each backdrop returns { defs:[], body:"" }. Blocks only where a motif earns its place. */
const BACKDROPS = {
  /** First impression: an answer crossing above the wordmark. */
  welcome: () =>
    ambient({
      lights: [
        [96, 330, 250, GOLD, 0.1],
        [370, 60, 300, BLUE, 0.07],
        [340, 720, 280, PURPLE, 0.05],
      ],
      focus: [195, 330, 760, 0.3],
      blocks: answers([2, 2, 7], [6, 0, 6], 70, 270),
    }),

  /** Tutorial: plain light — the practice grid is the motif. */
  tutorial: () =>
    ambient({
      lights: [
        [70, 60, 230, GOLD, 0.08],
        [380, 760, 260, PURPLE, 0.05],
      ],
      focus: [195, 300, 740, 0.3],
    }),

  /** Home: gold light where the day starts, a cool counterweight lower down. */
  home: () =>
    ambient({
      lights: [
        [330, 30, 240, GOLD, 0.09],
        [20, 460, 260, BLUE, 0.05],
      ],
      focus: [220, 320, 760, 0.3],
    }),

  /** In-game: the dot grid kept to the top and a vignette. Nothing competes with the grid. */
  game() {
    const vid = uid();
    const vdef =
      `<radialGradient id="${vid}" cx="195" cy="400" r="620" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0.45" stop-color="#000" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient>`;
    const b = ambient({
      lights: [
        [195, -30, 300, GOLD, 0.06],
        [380, 820, 280, BLUE, 0.04],
      ],
      focus: [195, 260, 640, 0.25],
      dotOpacity: 0.08,
    });
    return { defs: [...b.defs, vdef], body: b.body + `<rect width="${W}" height="${H}" fill="url(#${vid})"/>` };
  },

  /** Collection: lit in the category colours the facts come from. */
  collection: () =>
    ambient({
      lights: [
        [320, 70, 230, GOLD, 0.07],
        [30, 300, 260, PURPLE, 0.055],
        [370, 640, 260, GREEN, 0.045],
      ],
      focus: [195, 360, 760, 0.3],
    }),

  /** Leaderboard: light rising from the bottom corner, where the climb ends. */
  leaderboard: () =>
    ambient({
      lights: [
        [370, 660, 260, GOLD, 0.09],
        [20, 110, 240, BLUE, 0.045],
      ],
      focus: [220, 440, 780, 0.3],
    }),

  /** Profile: a gold halo behind the avatar, purple lower down. */
  profile: () =>
    ambient({
      lights: [
        [195, 178, 230, GOLD, 0.08],
        [380, 440, 260, PURPLE, 0.05],
      ],
      focus: [195, 330, 760, 0.3],
    }),

  /** Store: the warmest light in the app. */
  store: () =>
    ambient({
      lights: [
        [326, 96, 250, GOLD, 0.11],
        [30, 540, 260, GOLD, 0.04],
      ],
      focus: [230, 320, 760, 0.3],
    }),

  /** Activity: cool light, fading down the page like time. */
  activity: () =>
    ambient({
      lights: [
        [370, 90, 220, BLUE, 0.06],
        [20, 260, 240, GOLD, 0.05],
      ],
      focus: [195, 340, 760, 0.3],
    }),

  /** Lesson / success: the brightest light in the app, with a green note of "correct". */
  success: () =>
    ambient({
      lights: [
        [195, 250, 270, GOLD, 0.14],
        [50, 710, 260, GREEN, 0.05],
        [370, 640, 240, BLUE, 0.04],
      ],
      focus: [195, 360, 760, 0.3],
    }),
};

/* -------------------------------------------------------------------------- */
/*  The crux mark — icon family                                               */
/* -------------------------------------------------------------------------- */

// Mark geometry on a 1024 canvas at scale 1: squares of 196, 18 apart.
const MARK_S = 196;
const MARK_P = 214;
const ARMS = [[0, -1], [-1, 0], [1, 0], [0, 1]];

function markRect(cx, cy, s, attrs) {
  return `<rect x="${r2(cx - s / 2)}" y="${r2(cy - s / 2)}" width="${r2(s)}" height="${r2(s)}" rx="${r2(s * 0.155)}" ${attrs}/>`;
}

const goldDefs = () => [
  `<linearGradient id="goldFill" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${GOLD_HI}"/><stop offset="0.55" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_LO}"/></linearGradient>`,
  `<linearGradient id="goldSheen" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
];

/** The grid the mark sits in: neighbouring squares, dissolving outward. */
function ghostGrid({ cx = 512, cy = 512, scale = 1, extent = 3, opacity = 1, color = INK, strength = 0.075 }) {
  const S = MARK_S * scale;
  const P = MARK_P * scale;
  let out = "";
  for (let i = -extent; i <= extent; i++) {
    for (let j = -extent; j <= extent; j++) {
      const inMark = (i === 0 && Math.abs(j) <= 1) || (j === 0 && Math.abs(i) <= 1);
      if (inMark) continue;
      const o = clamp01(1.25 - Math.hypot(i, j) * 0.42) * opacity;
      if (o <= 0.02) continue;
      out += markRect(cx + i * P, cy + j * P, S, `fill="none" stroke="${color}" stroke-opacity="${r2(strength * o)}" stroke-width="${r2(3 * scale)}"`);
    }
  }
  return out;
}

/* Gold field ---------------------------------------------------------------- */

function goldFieldBackground() {
  return {
    defs: [
      `<linearGradient id="gfBase" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6db4c"/><stop offset="1" stop-color="#d9b81e"/></linearGradient>`,
      `<radialGradient id="gfLight" cx="512" cy="430" r="620" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
    ],
    body: `<rect width="1024" height="1024" fill="url(#gfBase)"/><rect width="1024" height="1024" fill="url(#gfLight)"/>`,
  };
}

/** Black arms; the crossing is an empty square, the one left to solve. */
function goldFieldMark({ scale = 1, color = "#0d0d0d" } = {}) {
  const S = MARK_S * scale;
  const P = MARK_P * scale;
  const sw = 14 * scale;
  let body = "";
  for (const [dx, dy] of ARMS) body += markRect(512 + dx * P, 512 + dy * P, S, `fill="${color}"`);
  body += markRect(512, 512, S - sw, `fill="none" stroke="${color}" stroke-width="${r2(sw)}"`);
  return body;
}

/* Gold outline -------------------------------------------------------------- */

/** Gold-outlined arms around a solid gold crossing, with its own glow. */
function outlineMark({ cx = 512, cy = 512, scale = 1, glowOpacity = 0.3 } = {}) {
  const S = MARK_S * scale;
  const P = MARK_P * scale;
  const sw = 12 * scale;
  const [gd, g] = glow(cx, cy, 360 * scale, GOLD, glowOpacity);
  let body = g;
  for (const [dx, dy] of ARMS) {
    body += markRect(cx + dx * P, cy + dy * P, S - sw, `fill="#101010" stroke="${GOLD}" stroke-opacity="0.9" stroke-width="${r2(sw)}"`);
  }
  body += markRect(cx, cy, S, `fill="url(#goldFill)"`) + markRect(cx, cy, S, `fill="url(#goldSheen)"`);
  return { defs: [gd, ...goldDefs()], body };
}

function darkBackground() {
  return [
    `<radialGradient id="bgWarm" cx="512" cy="470" r="720" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="#17150d"/><stop offset="0.6" stop-color="#0d0d0c"/><stop offset="1" stop-color="${BG}"/></radialGradient>`,
    `<rect width="1024" height="1024" fill="url(#bgWarm)"/>`,
  ];
}

const ICONS = {
  /** Launcher / store icon — Gold field, full bleed. */
  icon() {
    const bg = goldFieldBackground();
    const grid = ghostGrid({ color: "#0a0a0a", strength: 0.11 });
    return svgDoc(1024, 1024, bg.defs, bg.body + grid + goldFieldMark());
  },

  /** Alternate icon — Gold outline on black (promo, website, dark contexts). */
  iconOutline() {
    const [bd, bg] = darkBackground();
    const m = outlineMark();
    return svgDoc(1024, 1024, [bd, ...m.defs], bg + ghostGrid({ opacity: 0.8 }) + m.body);
  },

  /** Android adaptive background layer: the gold field and its grid. */
  adaptiveBackground() {
    const bg = goldFieldBackground();
    return svgDoc(1024, 1024, bg.defs, bg.body + ghostGrid({ scale: 0.8, color: "#0a0a0a", strength: 0.11 }));
  },

  /** Android adaptive foreground — the mark, inside the 66dp safe circle. */
  adaptiveForeground() {
    return svgDoc(1024, 1024, [], goldFieldMark({ scale: 0.8 }));
  },

  /** Android 13+ themed icon: alpha only, same silhouette as the launcher icon. */
  monochrome() {
    return svgDoc(1024, 1024, [], goldFieldMark({ scale: 0.8, color: "#fff" }));
  },

  /** Status-bar notification icon: the Gold outline mark, white on transparent. */
  notification() {
    const S = 26;
    const P = 30;
    const sw = 4;
    let body = "";
    for (const [dx, dy] of ARMS) {
      body += `<rect x="${48 + dx * P - S / 2 + sw / 2}" y="${48 + dy * P - S / 2 + sw / 2}" width="${S - sw}" height="${S - sw}" rx="4" fill="none" stroke="#fff" stroke-width="${sw}"/>`;
    }
    body += `<rect x="${48 - S / 2}" y="${48 - S / 2}" width="${S}" height="${S}" rx="5" fill="#fff"/>`;
    return svgDoc(96, 96, [], body);
  },

  /** Splash: Gold outline on transparent — app.json supplies #0a0a0a. */
  splash() {
    const m = outlineMark({ scale: 0.72, glowOpacity: 0.24 });
    return svgDoc(1024, 1024, m.defs, ghostGrid({ scale: 0.72, extent: 2, opacity: 0.8 }) + m.body);
  },

  /** The wordmark from the welcome screen, as a reusable asset. */
  wordmark() {
    const s = 92;
    const gap = 12;
    const letters = ["C", "R", "U", "X", "E"];
    let body = "";
    letters.forEach((l, i) => {
      const x = i * (s + gap) + 2;
      const accent = i === 0;
      body +=
        `<rect x="${x}" y="2" width="${s}" height="${s}" rx="12" fill="${accent ? "rgba(238,205,43,0.1)" : "#1a1a1a"}" ` +
        `stroke="${accent ? GOLD : "rgba(255,255,255,0.12)"}" stroke-width="2"/>` +
        `<text x="${x + s / 2}" y="${2 + s / 2 + 15}" font-family="${FONT_UI}" font-weight="700" font-size="44" ` +
        `text-anchor="middle" fill="${accent ? GOLD : INK}">${l}</text>`;
    });
    const w = letters.length * (s + gap) - gap + 4;
    return svgDoc(w, s + 4, [], body);
  },

  /** Google Play feature graphic, 1024×500: graph paper, ambient light, the outline mark. */
  featureGraphic() {
    const fw = 1024;
    const fh = 500;
    const cx = 800;
    const cy = 250;
    const [gd, g] = glow(cx, cy, 320, GOLD, 0.14);
    const [bd, b] = glow(1010, 30, 320, BLUE, 0.09);
    const [pd, p] = glow(560, 500, 280, PURPLE, 0.05);
    const [fd, f] = fog(fw, fh, cx, cy, 560, 0.1);
    const m = outlineMark({ cx, cy, scale: 0.46, glowOpacity: 0.28 });

    const s = 64;
    const gap = 8;
    let mark = "";
    ["C", "R", "U", "X", "E"].forEach((l, i) => {
      const x = 76 + i * (s + gap);
      const y = 138;
      const accent = i === 0;
      mark +=
        `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="9" fill="${accent ? "rgba(238,205,43,0.1)" : "#1a1a1a"}" ` +
        `stroke="${accent ? GOLD : "rgba(255,255,255,0.14)"}" stroke-width="1.5"/>` +
        `<text x="${x + s / 2}" y="${y + s / 2 + 11}" font-family="${FONT_UI}" font-weight="700" font-size="31" ` +
        `text-anchor="middle" fill="${accent ? GOLD : INK}">${l}</text>`;
    });
    const text =
      `<text x="76" y="286" font-family="${FONT_UI}" font-weight="700" font-size="46" fill="${INK}">The Elite Crossword</text>` +
      `<text x="78" y="330" font-family="${FONT_UI}" font-weight="400" font-size="21" fill="${MUTED}">A new set every day. Made properly.</text>`;
    // Paper pitch matches the mark's own pitch, so the mark sits on the grid.
    const pitch = MARK_P * 0.46;
    const lines = paperLines(fw + pitch, fh + pitch, pitch, 0.07).replace("<g ", `<g transform="translate(${r2(((cx - pitch / 2) % pitch) - pitch)} ${r2(((cy - pitch / 2) % pitch) - pitch)})" `);
    return svgDoc(fw, fh, [gd, bd, pd, fd, ...m.defs], b + p + g + lines + f + m.body + mark + text, { bg: BG });
  },
};

/* -------------------------------------------------------------------------- */
/*  Output                                                                    */
/* -------------------------------------------------------------------------- */

function backdropSvg(name, withBg) {
  const { defs, body } = BACKDROPS[name]();
  return svgDoc(W, H, defs, body, { bg: withBg ? BG : undefined, slice: true });
}

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function main() {
  const { Resvg } = require("@resvg/resvg-js");
  const fontFiles = ["400Regular/Manrope_400Regular.ttf", "600SemiBold/Manrope_600SemiBold.ttf", "700Bold/Manrope_700Bold.ttf"].map(
    (f) => path.join(FONT_DIR, f),
  );
  const render = (svg, width, rel) => {
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { fontFiles, loadSystemFonts: false, defaultFontFamily: FONT_UI },
    })
      .render()
      .asPng();
    write(rel, png);
  };
  const both = (name, svg, sizes) => {
    write(`svg/${name}.svg`, svg);
    for (const [w, file] of sizes) render(svg, w, `png/${file}`);
  };

  both("icon", ICONS.icon(), [
    [1024, "icon.png"],
    [512, "play-store-icon-512.png"],
    [48, "favicon.png"],
  ]);
  both("icon-outline", ICONS.iconOutline(), [[1024, "icon-outline.png"]]);
  both("adaptive-foreground", ICONS.adaptiveForeground(), [[1024, "adaptive-icon.png"]]);
  both("adaptive-background", ICONS.adaptiveBackground(), [[1024, "adaptive-icon-background.png"]]);
  both("adaptive-monochrome", ICONS.monochrome(), [[1024, "adaptive-icon-monochrome.png"]]);
  both("notification-icon", ICONS.notification(), [[96, "notification-icon.png"]]);
  both("splash-icon", ICONS.splash(), [[1024, "splash-icon.png"]]);
  both("wordmark", ICONS.wordmark(), [[1040, "wordmark.png"]]);
  both("feature-graphic", ICONS.featureGraphic(), [[1024, "play-feature-graphic.png"]]);

  // Backdrops: standalone SVGs, previews, and a TS module for react-native-svg.
  const module = [];
  for (const name of Object.keys(BACKDROPS)) {
    const svg = backdropSvg(name, false);
    write(`backdrops/${name}.svg`, svg);
    render(backdropSvg(name, true), 780, `backdrops/preview/${name}.png`);
    module.push(`  ${name}: ${JSON.stringify(svg)},`);
  }
  write(
    "backdrops/backdrops.generated.ts",
    `// Generated by scripts/brand/generate-brand.cjs — do not edit by hand.\n` +
      `export const BACKDROPS = {\n${module.join("\n")}\n} as const;\n\n` +
      `export type BackdropVariant = keyof typeof BACKDROPS;\n`,
  );

  console.log(`Brand assets written to ${path.relative(ROOT, OUT)}`);
}

if (require.main === module) main();

module.exports = { BACKDROPS, ICONS, backdropSvg };

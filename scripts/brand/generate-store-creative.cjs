/**
 * Builds the App Store art that is not a screenshot.
 *
 *   npm run brand:store:creative
 *
 *   assets/store/iap-promo/coins-*.png        1024×1024   promoted In-App Purchase images
 *   assets/store/creative/header.png          3840×1646   product page header (21:9)
 *   assets/store/creative/search-result.png   3840×2560   search results (3:2)
 *
 * In-App Purchase images. Guideline 2.3.2 rejects one that is a screenshot of
 * the app, so these are illustrations: the coins of each pack resting on a
 * crossword floor, on its gold crossing square. Bigger packs pile higher. The
 * pack name and coin count sit above, so each image says what it sells. The
 * lower-left corner (where the App Store puts the app icon outside the product
 * page) is left empty.
 *
 * Creative assets. The header is a crossword fragment, the words crossing on
 * gold squares, in a field of tiles fading into the dark. The search result has
 * to state the app's purpose at a glance, so it pairs one headline with three
 * real captures. Both keep their focal point in the centre, since Apple crops
 * them differently per device.
 *
 * All output is 24-bit PNG: Apple rejects alpha. Specs:
 * developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications
 */
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { toRgbPng } = require("./png.cjs");
const { loadCapture, phone, PHONE_DEFS } = require("./iphone.cjs");

const ROOT = path.resolve(__dirname, "../..");
const IAP_OUT = path.join(ROOT, "assets/store/iap-promo");
const CREATIVE_OUT = path.join(ROOT, "assets/store/creative");
const FONTS = path.join(ROOT, "node_modules/@expo-google-fonts");

// Palette — mirrors constants/theme.ts and generate-brand.cjs.
const BG = "#0a0a0a";
const INK = "#f8f8f6";
const MUTED = "#a3a39c";
const GOLD = "#eecd2b";
const GOLD_HI = "#fbe78a";
const GOLD_LO = "#b8960f";
const GOLD_DEEP = "#7a6208";
const TILE = "#1a1a1a";

const FONT_OPTS = {
  fontFiles: [
    "manrope/500Medium/Manrope_500Medium.ttf",
    "manrope/700Bold/Manrope_700Bold.ttf",
    "manrope/800ExtraBold/Manrope_800ExtraBold.ttf",
    "space-mono/400Regular/SpaceMono_400Regular.ttf",
  ].map((f) => path.join(FONTS, f)),
  loadSystemFonts: false,
  defaultFontFamily: "Manrope",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const r1 = (n) => Math.round(n * 10) / 10;

// Deterministic noise, so every run draws the same picture.
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A four-pointed glint. */
function sparkle(x, y, size, opacity = 1, color = "#fff") {
  const a = size;
  const b = size * 0.16;
  return `<path d="M ${x} ${y - a} Q ${x + b} ${y - b} ${x + a} ${y} Q ${x + b} ${y + b} ${x} ${y + a} Q ${x - b} ${y + b} ${x - a} ${y} Q ${x - b} ${y - b} ${x} ${y - a} Z" fill="${color}" fill-opacity="${opacity}"/>`;
}

/** The crux: two arms crossing on a centre square, embossed on a coin face. */
function cruxEmboss(u) {
  const sq = (cx, cy, fill) =>
    `<rect x="${r1(cx - u * 0.42)}" y="${r1(cy - u * 0.42)}" width="${r1(u * 0.84)}" height="${r1(u * 0.84)}" rx="${r1(u * 0.14)}" fill="${fill}"/>`;
  let s = "";
  // Shadow pass, then the raised pass offset up-left.
  for (const [dx, dy, arm, centre] of [
    [u * 0.07, u * 0.07, GOLD_DEEP, GOLD_DEEP],
    [0, 0, GOLD_LO, GOLD_HI],
  ]) {
    s += sq(dx - u, dy, arm) + sq(dx + u, dy, arm) + sq(dx, dy - u, arm) + sq(dx, dy + u, arm) + sq(dx, dy, centre);
  }
  return s;
}

const COIN_DEFS = [
  `<linearGradient id="coinFace" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GOLD_HI}"/><stop offset="0.45" stop-color="${GOLD}"/><stop offset="1" stop-color="#c9a812"/></linearGradient>`,
  `<linearGradient id="coinRim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD_DEEP}"/><stop offset="0.3" stop-color="${GOLD_LO}"/>` +
    `<stop offset="0.55" stop-color="${GOLD}"/><stop offset="0.8" stop-color="${GOLD_LO}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>`,
  `<linearGradient id="coinEdge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD_LO}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>`,
  `<radialGradient id="coinShine" cx="0.32" cy="0.28" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
  `<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>`,
  `<filter id="haze" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>`,
];

/** A coin face, drawn upright and centred on the origin. */
function coinFace(r) {
  return (
    `<circle r="${r1(r)}" fill="url(#coinFace)"/>` +
    `<circle r="${r1(r * 0.82)}" fill="none" stroke="${GOLD_LO}" stroke-width="${r1(r * 0.05)}"/>` +
    `<circle r="${r1(r * 0.82)}" fill="none" stroke="${GOLD_HI}" stroke-opacity="0.6" stroke-width="${r1(r * 0.02)}" transform="translate(${r1(-r * 0.02)} ${r1(-r * 0.02)})"/>` +
    cruxEmboss(r * 0.2) +
    `<circle r="${r1(r)}" fill="url(#coinShine)"/>`
  );
}

// ---------------------------------------------------------------------------
// In-App Purchase images: coins on a crossword floor, seen in perspective.

const S = 1024;
const CAM = { f: 640, h: 1.4, horizon: 380 }; // focal length (px), eye height (units), horizon (px)
const COIN_R = 0.42; // units
const COIN_T = 0.12; // units

const project = (x, y, z) => ({
  x: S / 2 + (x * CAM.f) / z,
  y: CAM.horizon + ((CAM.h - y) * CAM.f) / z,
  s: CAM.f / z,
});

/**
 * The floor: dark tiles receding to the horizon; the centre one is the gold
 * crux. The crux comes back separately, because it is drawn with its bloom
 * outside the floor's fade mask (resvg panics on a blur filter inside a mask).
 */
function floor() {
  let s = "";
  let crux = "";
  const gap = 0.07;
  for (let k = 0; k < 14; k++) {
    const z0 = 1.2 + k;
    const z1 = z0 + 1;
    for (let i = -9; i <= 9; i++) {
      const x0 = i - 0.5 + gap;
      const x1 = i + 0.5 - gap;
      const a = project(x0, 0, z0 + gap);
      const b = project(x1, 0, z0 + gap);
      const c = project(x1, 0, z1 - gap);
      const d = project(x0, 0, z1 - gap);
      const pts = [a, b, c, d].map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ");
      const centre = i === 0 && k === 1;
      const arm = (Math.abs(i) === 1 && k === 1) || (i === 0 && (k === 0 || k === 2));
      if (centre) {
        crux =
          `<polygon points="${pts}" fill="${GOLD}" filter="url(#haze)" fill-opacity="0.8"/>` +
          `<polygon points="${pts}" fill="${GOLD}" fill-opacity="0.95"/>`;
      } else if (arm) {
        s += `<polygon points="${pts}" fill="${TILE}" stroke="${GOLD}" stroke-opacity="0.75" stroke-width="2.5"/>`;
      } else {
        s += `<polygon points="${pts}" fill="${TILE}" stroke="#fff" stroke-opacity="0.05" stroke-width="1"/>`;
      }
    }
  }
  return { tiles: s, crux };
}

/** One coin lying flat, its top face at height y. */
function flatCoin(x, y, z) {
  const top = project(x, y, z);
  const r = COIN_R * top.s;
  // How much of the face we see shrinks as the eye nears its height.
  const tilt = Math.max(0.14, (CAM.h - y) / z);
  const ry = r * tilt;
  const t = COIN_T * top.s;
  const cx = r1(top.x);
  const cy = r1(top.y);
  const rim = `M ${r1(cx - r)} ${cy} L ${r1(cx - r)} ${r1(cy + t)} A ${r1(r)} ${r1(ry)} 0 0 0 ${r1(cx + r)} ${r1(cy + t)} L ${r1(cx + r)} ${cy} Z`;
  // Milled edge: short vertical ticks across the rim.
  let ticks = "";
  for (let a = 0.12; a < Math.PI; a += 0.16) {
    const tx = cx - Math.cos(a) * r;
    const ty = cy + Math.sin(a) * ry;
    ticks += `M ${r1(tx)} ${r1(ty + t * 0.15)} L ${r1(tx)} ${r1(ty + t * 0.85)} `;
  }
  return (
    `<path d="${rim}" fill="url(#coinRim)"/>` +
    `<path d="${ticks}" stroke="${GOLD_DEEP}" stroke-opacity="0.5" stroke-width="${r1(Math.max(1, r * 0.012))}"/>` +
    `<g transform="translate(${cx} ${cy}) scale(1 ${r1(tilt * 1000) / 1000})">${coinFace(r)}</g>`
  );
}

/** A stack of n coins, a little uneven, plus its contact shadow. */
function stack(x, z, n, seed = 0) {
  const base = project(x, 0, z);
  let s = `<ellipse cx="${r1(base.x)}" cy="${r1(base.y)}" rx="${r1(COIN_R * base.s * 1.15)}" ry="${r1(COIN_R * base.s * 0.42)}" fill="#000" fill-opacity="0.7" filter="url(#soft)"/>`;
  for (let i = 0; i < n; i++) {
    const jx = (hash(seed * 31 + i) - 0.5) * 0.06;
    const jz = (hash(seed * 17 + i + 5) - 0.5) * 0.04;
    s += flatCoin(x + jx, (i + 1) * COIN_T, z + jz);
  }
  return s;
}

/** A coin standing on its edge, turned slightly to show its thickness. */
function uprightCoin(x, z, turn = 0.82) {
  const c = project(x, COIN_R, z);
  const r = COIN_R * c.s;
  const t = COIN_T * c.s * 0.9;
  const base = project(x, 0, z);
  return (
    `<ellipse cx="${r1(base.x)}" cy="${r1(base.y)}" rx="${r1(r * 0.9)}" ry="${r1(r * 0.16)}" fill="#000" fill-opacity="0.75" filter="url(#soft)"/>` +
    `<ellipse cx="${r1(c.x + t)}" cy="${r1(c.y)}" rx="${r1(r * turn)}" ry="${r1(r)}" fill="url(#coinEdge)"/>` +
    `<rect x="${r1(c.x)}" y="${r1(c.y - r)}" width="${r1(t)}" height="${r1(2 * r)}" fill="url(#coinEdge)"/>` +
    `<g transform="translate(${r1(c.x)} ${r1(c.y)}) scale(${turn} 1)">${coinFace(r)}</g>`
  );
}

/**
 * Each pack is a scene: piles of coins (x, z, count) and standing coins
 * (x, z), drawn back to front. The crux tile spans x ∈ [-0.5, 0.5], z ∈ [2.2, 3.2].
 */
const PACKS = [
  {
    file: "starter",
    name: "Starter Pack",
    coins: 300,
    piles: [[-0.62, 3.0, 2], [0.68, 2.55, 1]],
    standing: [[0.02, 2.75]],
    sparkles: [[800, 410, 22], [240, 470, 13], [660, 640, 10]],
  },
  {
    file: "plus",
    name: "Plus Pack",
    coins: 1800,
    piles: [[0.05, 2.95, 5], [-0.72, 2.75, 2], [0.75, 3.35, 1], [-0.25, 2.25, 1]],
    standing: [[0.62, 2.5]],
    sparkles: [[810, 390, 24], [210, 430, 14], [870, 560, 10], [330, 560, 9]],
  },
  {
    file: "pro",
    name: "Pro Pack",
    coins: 3900,
    piles: [[0.0, 3.1, 8], [-0.78, 2.9, 5], [0.78, 3.0, 4], [-0.4, 2.3, 2], [1.15, 3.6, 1], [0.45, 2.25, 1]],
    standing: [[-1.2, 3.3]],
    sparkles: [[830, 360, 26], [190, 390, 16], [890, 500, 12], [140, 520, 9]],
  },
  {
    file: "elite",
    name: "Elite Pack",
    coins: 9000,
    piles: [
      [0.0, 3.3, 10], [-0.82, 3.1, 8], [0.82, 3.2, 9], [-1.5, 3.6, 4], [1.55, 3.7, 5],
      [-0.42, 2.45, 4], [0.45, 2.4, 3], [0.0, 2.05, 1], [-1.0, 2.35, 1], [1.05, 2.4, 2],
    ],
    standing: [[-1.25, 2.75], [1.3, 2.9]],
    sparkles: [[870, 250, 26], [150, 270, 18], [900, 420, 14], [120, 440, 10], [770, 360, 9], [250, 370, 9]],
  },
];

function iapSvg(pack) {
  const centre = project(0, 0.6, 2.9);
  const defs = [
    ...COIN_DEFS,
    `<radialGradient id="glow" cx="${r1(centre.x)}" cy="${r1(centre.y)}" r="560" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${GOLD}" stop-opacity="0.32"/><stop offset="0.4" stop-color="${GOLD}" stop-opacity="0.09"/>` +
      `<stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.36" stop-color="#fff" stop-opacity="0"/>` +
      `<stop offset="0.62" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>`,
    `<mask id="floorMask"><rect width="${S}" height="${S}" fill="url(#floorFade)"/></mask>`,
    // Darkens the corners, the lower left most, where the App Store places the icon.
    `<radialGradient id="vignette" cx="0.55" cy="0.5" r="0.8"><stop offset="0.55" stop-color="${BG}" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="${BG}" stop-opacity="0.92"/></radialGradient>`,
    `<linearGradient id="countFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6e1cc"/></linearGradient>`,
    `<filter id="textShadow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>`,
  ];

  const objects = [
    ...pack.piles.map(([x, z, n], i) => ({ z, draw: () => stack(x, z, n, i + 1) })),
    ...pack.standing.map(([x, z]) => ({ z, draw: () => uprightCoin(x, z) })),
  ].sort((a, b) => b.z - a.z);
  const ground = floor();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>${defs.join("")}</defs>
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <g mask="url(#floorMask)">${ground.tiles}</g>
  ${ground.crux}
  <rect width="${S}" height="${S}" fill="url(#glow)"/>
  ${objects.map((o) => o.draw()).join("")}
  ${pack.sparkles.map(([x, y, sz]) => sparkle(x, y, sz, 0.9)).join("")}
  <rect width="${S}" height="${S}" fill="url(#vignette)"/>
  ${packTitle(pack)}
</svg>`;
}

/**
 * The label: pack name between two short gold rules, the coin count large
 * beneath it, and "COINS" under that. Drawn last so nothing covers it.
 */
function packTitle(pack) {
  const cx = S / 2;
  const name = esc(pack.name.toUpperCase());
  const count = pack.coins.toLocaleString("en-US");
  // Space Mono is monospaced: each glyph advances 0.6em, plus the tracking.
  const nameW = name.length * (26 * 0.6 + 9);
  const rule = (x1, x2) => `<line x1="${r1(x1)}" y1="104" x2="${r1(x2)}" y2="104" stroke="${GOLD}" stroke-opacity="0.7" stroke-width="2"/>`;
  return (
    rule(cx - nameW / 2 - 84, cx - nameW / 2 - 30) +
    rule(cx + nameW / 2 + 30, cx + nameW / 2 + 84) +
    `<text x="${cx + 4.5}" y="113" text-anchor="middle" font-family="Space Mono" font-size="26" letter-spacing="9" fill="${GOLD}">${name}</text>` +
    `<text x="${cx}" y="250" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="150" letter-spacing="-4" fill="#000" fill-opacity="0.85" filter="url(#textShadow)">${count}</text>` +
    `<text x="${cx}" y="246" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="150" letter-spacing="-4" fill="url(#countFill)">${count}</text>` +
    `<text x="${cx + 8}" y="304" text-anchor="middle" font-family="Manrope" font-weight="700" font-size="32" letter-spacing="16" fill="${MUTED}">COINS</text>`
  );
}

// ---------------------------------------------------------------------------
// Product page header: a crossword fragment in a field of tiles.

// Words as [row, col, direction, word]. Crossings are drawn gold.
const HEADER_WORDS = [
  [0, -2, "across", "CRUXE"],
  [-2, 0, "down", "CLUE"],
  [-1, -2, "down", "ACE"],
  [-1, 2, "down", "HEX"],
];

function headerSvg() {
  const W = 1920; // drawn at half size, rendered at 3840
  const H = 823;
  const T = 92; // tile
  const STEP = 104;
  const ox = W / 2;
  const oy = H / 2 + STEP / 2; // the words span rows -2..1, so centre on -0.5

  const letters = new Map();
  const count = new Map();
  for (const [row, col, dir, word] of HEADER_WORDS) {
    [...word].forEach((ch, i) => {
      const key = dir === "across" ? `${row},${col + i}` : `${row + i},${col}`;
      letters.set(key, ch);
      count.set(key, (count.get(key) || 0) + 1);
    });
  }

  const defs = [
    `<radialGradient id="glow" cx="${ox}" cy="${oy - STEP / 2}" r="760" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.22"/>` +
      `<stop offset="0.45" stop-color="${GOLD}" stop-opacity="0.06"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="goldTile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD_HI}"/><stop offset="1" stop-color="${GOLD}"/></linearGradient>`,
    `<linearGradient id="inkTile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232323"/><stop offset="1" stop-color="#161616"/></linearGradient>`,
    `<filter id="tileShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>`,
    `<filter id="goldBloom" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="26"/></filter>`,
  ];

  let field = "";
  let words = "";
  const filler = "ETAOINSRHLDCUMWFGYPBVK";
  for (let row = -5; row <= 4; row++) {
    for (let col = -10; col <= 10; col++) {
      const x = ox + col * STEP - T / 2;
      const y = oy + row * STEP - T / 2;
      const key = `${row},${col}`;
      const ch = letters.get(key);
      if (ch) {
        const crossing = count.get(key) > 1;
        words += `<rect x="${x + 4}" y="${y + 14}" width="${T}" height="${T}" rx="14" fill="#000" fill-opacity="0.8" filter="url(#tileShadow)"/>`;
        if (crossing) {
          words += `<rect x="${x - 6}" y="${y - 6}" width="${T + 12}" height="${T + 12}" rx="18" fill="${GOLD}" fill-opacity="0.55" filter="url(#goldBloom)"/>`;
          words += `<rect x="${x}" y="${y + 6}" width="${T}" height="${T}" rx="14" fill="${GOLD_LO}"/>`;
          words += `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="14" fill="url(#goldTile)"/>`;
          words += `<text x="${x + T / 2}" y="${y + T / 2 + 19}" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="54" fill="${BG}">${ch}</text>`;
        } else {
          words += `<rect x="${x}" y="${y + 6}" width="${T}" height="${T}" rx="14" fill="#0e0e0e"/>`;
          words += `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="14" fill="url(#inkTile)" stroke="#fff" stroke-opacity="0.14" stroke-width="1.5"/>`;
          words += `<text x="${x + T / 2}" y="${y + T / 2 + 19}" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="54" fill="${INK}">${ch}</text>`;
        }
        continue;
      }
      // The field: tiles dim with distance from the centre; some are black
      // squares, a few carry a ghost letter.
      const dx = (col * STEP) / (W * 0.55);
      const dy = ((row + 0.5) * STEP) / (H * 0.75);
      const d = Math.sqrt(dx * dx + dy * dy);
      const o = Math.max(0, 1 - d) ** 1.4;
      if (o < 0.02) continue;
      const n = hash(row * 41 + col * 7);
      if (n < 0.22) continue; // a black square: the grid's gaps
      field += `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="14" fill="${TILE}" fill-opacity="${r1(o * 0.9 * 100) / 100}" stroke="#fff" stroke-opacity="${r1(o * 0.08 * 100) / 100}" stroke-width="1.5"/>`;
      if (n > 0.8) {
        const g = filler[Math.floor(hash(row * 13 + col * 29) * filler.length)];
        field += `<text x="${x + T / 2}" y="${y + T / 2 + 17}" text-anchor="middle" font-family="Manrope" font-weight="700" font-size="48" fill="${INK}" fill-opacity="${r1(o * 0.16 * 100) / 100}">${g}</text>`;
      }
    }
  }

  const glints = [[ox + 3.1 * STEP, oy - 2.6 * STEP, 18], [ox - 3.2 * STEP, oy - 1.9 * STEP, 12], [ox + 0.6 * STEP, oy + 1.9 * STEP, 10]]
    .map(([x, y, s]) => sparkle(x, y, s, 0.85))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${defs.join("")}</defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${field}${words}${glints}
</svg>`;
}

// ---------------------------------------------------------------------------
// Search result: one line of purpose, three real screens.

function searchSvg(caps) {
  const W = 1920; // drawn at half size, rendered at 3840
  const H = 1280;
  const PW = 470;
  const defs = [
    ...PHONE_DEFS,
    `<radialGradient id="glow" cx="${W / 2}" cy="${H * 0.7}" r="1000" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.2"/>` +
      `<stop offset="0.5" stop-color="${GOLD}" stop-opacity="0.06"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>`,
    `<pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.6" fill="${INK}" fill-opacity="0.08"/></pattern>`,
  ];
  const side = PW * 0.92;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${defs.join("")}</defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="${W / 2}" y="132" text-anchor="middle" font-family="Space Mono" font-size="28" letter-spacing="8" fill="${GOLD}">${esc("THE DAILY CROSSWORD")}</text>
  <text x="${W / 2}" y="250" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="104" letter-spacing="-2.5" fill="${INK}">Across, down, back and <tspan fill="${GOLD}">up</tspan>.</text>
  ${/* Not the Collection screen: its "Free" tags count as pricing, which creative assets can't show. */ ""}
  ${phone(caps.home, { x: W / 2 - side - 290, y: 440, w: side, glow: false })}
  ${phone(caps.takeaway, { x: W / 2 + 290, y: 440, w: side, glow: false })}
  ${phone(caps.solving, { x: W / 2 - PW / 2, y: 340, w: PW })}
</svg>`;
}

// ---------------------------------------------------------------------------

function render(svg, px, file) {
  const rendered = new Resvg(svg, { fitTo: { mode: "width", value: px[0] }, font: FONT_OPTS }).render();
  if (rendered.width !== px[0] || rendered.height !== px[1]) {
    throw new Error(`${file}: ${rendered.width}×${rendered.height}, expected ${px[0]}×${px[1]}`);
  }
  const png = toRgbPng(rendered);
  fs.writeFileSync(file, png);
  console.log(`${path.relative(ROOT, file)}  ${rendered.width}x${rendered.height}  ${Math.round(png.length / 1024)} KB`);
}

async function main() {
  fs.mkdirSync(IAP_OUT, { recursive: true });
  fs.mkdirSync(CREATIVE_OUT, { recursive: true });
  for (const pack of PACKS) render(iapSvg(pack), [S, S], path.join(IAP_OUT, `coins-${pack.file}.png`));

  render(headerSvg(), [3840, 1646], path.join(CREATIVE_OUT, "header.png"));

  const caps = {};
  for (const n of ["home", "takeaway", "solving"]) caps[n] = await loadCapture(n);
  render(searchSvg(caps), [3840, 2560], path.join(CREATIVE_OUT, "search-result.png"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

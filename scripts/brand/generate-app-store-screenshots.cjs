/**
 * Builds the App Store screenshots from real iPhone captures.
 *
 *   npm run brand:store:ios   →   assets/store/screenshots-ios/6.9-inch/   1320×2868
 *                                 assets/store/screenshots-ios/6.5-inch/   1284×2778
 *
 * App Store Connect wants one iPhone set: 6.9" if its slot is offered, else
 * 6.5". Each slot rejects the other's dimensions, so both are built and the
 * one matching the slot on screen is uploaded. No iPad set: supportsTablet is
 * false. Output is 24-bit PNG, since Apple rejects alpha.
 *
 * Captures live in assets/store/ios-captures/ (1242×2688, from an iPhone 11
 * Pro Max) and are shown exactly as taken: whole, upright, uncropped. Only the
 * presentation around them is designed — a headline, the app's dark ground
 * with its dot grid and gold light, and a modern iPhone frame.
 *
 * To change a screen, replace its capture (same file name) and rerun.
 *
 * The Store slide is optional: it is built only once store.jpg exists, since
 * that capture has to come from a device showing real App Store prices.
 */
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { toRgbPng } = require("./png.cjs");
const { loadCapture, phone, PHONE_DEFS } = require("./iphone.cjs");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "assets/store/screenshots-ios");
const FONTS = path.join(ROOT, "node_modules/@expo-google-fonts");

// The layout is drawn 1320 wide. Each size only sets the canvas height (1320 ×
// its aspect ratio), then renders at its real pixel width.
const W = 1320;
const SIZES = [
  { dir: "6.9-inch", px: [1320, 2868] },
  { dir: "6.5-inch", px: [1284, 2778] },
];

// Palette — mirrors constants/theme.ts.
const BG = "#0a0a0a";
const TEXT = "#f8f8f6";
const MUTED = "#a3a39c";
const GOLD = "#eecd2b";

const FONT_OPTS = {
  fontFiles: [
    "manrope/500Medium/Manrope_500Medium.ttf",
    "manrope/800ExtraBold/Manrope_800ExtraBold.ttf",
    "space-mono/400Regular/SpaceMono_400Regular.ttf",
  ].map((f) => path.join(FONTS, f)),
  loadSystemFonts: false,
  defaultFontFamily: "Manrope",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------------------------------------------------------------------------
// Caption

/**
 * A small gold label, then a two-line headline in which `*marked*` words are
 * gold, then one muted line. Everything is centred.
 */
function caption({ label, headline, sub }) {
  const cx = W / 2;
  let s = `<text x="${cx}" y="178" text-anchor="middle" font-family="Space Mono" font-size="30" letter-spacing="7" fill="${GOLD}">${esc(label.toUpperCase())}</text>`;
  headline.forEach((line, i) => {
    const spans = line
      .split(/(\*[^*]+\*)/)
      .filter(Boolean)
      .map((part) =>
        part.startsWith("*") ? `<tspan fill="${GOLD}">${esc(part.slice(1, -1))}</tspan>` : esc(part),
      )
      .join("");
    s += `<text x="${cx}" y="${312 + i * 122}" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="104" letter-spacing="-2.5" fill="${TEXT}">${spans}</text>`;
  });
  s += `<text x="${cx}" y="${312 + headline.length * 122 - 8}" text-anchor="middle" font-family="Manrope" font-weight="500" font-size="42" fill="${MUTED}">${esc(sub)}</text>`;
  return s;
}

// ---------------------------------------------------------------------------
// Background: the app's own ground — near-black, a soft gold light behind the
// phone, and its dot grid fading out toward the bottom.

function background(glowY, H) {
  const defs = [
    `<radialGradient id="glow" cx="${W / 2}" cy="${glowY}" r="1000" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${GOLD}" stop-opacity="0.17"/><stop offset="0.5" stop-color="${GOLD}" stop-opacity="0.06"/>` +
      `<stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="topLight" cx="${W / 2}" cy="0" r="900" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`,
    `<pattern id="dots" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="22" cy="22" r="2" fill="${TEXT}" fill-opacity="0.07"/></pattern>`,
    `<linearGradient id="dotFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/>` +
      `<stop offset="0.6" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<mask id="dotMask"><rect width="${W}" height="${H}" fill="url(#dotFade)"/></mask>`,
  ];
  const svg =
    `<rect width="${W}" height="${H}" fill="${BG}"/>` +
    `<rect width="${W}" height="${H}" fill="url(#dots)" mask="url(#dotMask)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#topLight)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#glow)"/>`;
  return { defs, svg };
}

// ---------------------------------------------------------------------------
// Slides — in listing order. The first three are what search results show.

// One phone, centred under the caption and shown in full.
const PHONE_W = 1000;
const single = (name) => (c) => phone(c[name], { x: (W - PHONE_W) / 2, y: 690, w: PHONE_W });

const SLIDES = [
  {
    file: "01-solve",
    label: "The elite crossword",
    headline: ["Across, down,", "back and *up*."],
    sub: "Answers run all four ways. One tap switches.",
    draw: single("solving"),
  },
  {
    file: "02-daily",
    label: "Daily challenge",
    headline: ["A fresh puzzle set,", "*every day*."],
    sub: "New puzzles each morning, across every category.",
    draw: single("home"),
  },
  {
    file: "03-collection",
    label: "Today's collection",
    headline: ["Pick your size.", "Pick your *difficulty*."],
    sub: "Easy to Expert, 6×6 to 12×12.",
    draw: single("collection"),
  },
  {
    file: "04-hints",
    label: "Hints",
    headline: ["Stuck? Get a", "*nudge*."],
    sub: "Reveal a letter, a word, or check for errors.",
    draw: single("hints"),
  },
  {
    file: "05-score",
    label: "Every solve scored",
    headline: ["Scored on how", "*you solve*."],
    sub: "Time, accuracy and hints turn into points.",
    // Two phones, upright and staggered: the result in front, the breakdown
    // behind it.
    draw: (c) =>
      phone(c.insights, { x: 60, y: 690, w: 820, glow: false }) + phone(c.solved, { x: 440, y: 970, w: 820 }),
  },
  {
    file: "06-takeaway",
    label: "Takeaway",
    headline: ["The story behind", "*every answer*."],
    sub: "Each puzzle ends with a short, sharp read.",
    draw: single("takeaway"),
  },
  {
    file: "07-leaderboard",
    label: "Leaderboard",
    headline: ["Climb the", "*global* leaderboard."],
    sub: "Every solve earns points toward your rank.",
    draw: single("leaderboard"),
  },
  {
    file: "08-sign-in",
    label: "One account",
    headline: ["Your streak goes", "*where you go*."],
    sub: "Sign in with Apple, Google or an email code.",
    draw: single("welcome"),
  },
  {
    file: "09-store",
    label: "Coin packs",
    headline: ["Want more?", "*Keep going*."],
    sub: "Coins come from solving, or top up any time.",
    draw: single("store"),
    optional: "store",
  },
];

function slideSvg(slide, caps, H) {
  const bg = background(1500, H);
  const body = bg.svg + slide.draw(caps) + caption(slide);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${PHONE_DEFS.join("")}${bg.defs.join("")}</defs>${body}</svg>`;
}

async function main() {
  const names = ["welcome", "home", "collection", "leaderboard", "hints", "solving", "solved", "takeaway", "insights"];
  const caps = {};
  for (const n of names) caps[n] = await loadCapture(n);
  const hasStore = fs.existsSync(path.join(__dirname, "../../assets/store/ios-captures/store.jpg"));
  if (hasStore) caps.store = await loadCapture("store");
  else console.log("No ios-captures/store.jpg yet: skipping 09-store.");

  // Pass part of a file name to rebuild one slide. A full run clears the
  // folder first, so only this set can be uploaded.
  const only = process.argv[2];
  if (!only) fs.rmSync(OUT, { recursive: true, force: true });
  for (const { dir, px } of SIZES) {
    const [PX_W, PX_H] = px;
    const H = (W * PX_H) / PX_W;
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    for (const slide of SLIDES) {
      if (only && !slide.file.includes(only)) continue;
      if (slide.optional && !caps[slide.optional]) continue;
      const rendered = new Resvg(slideSvg(slide, caps, H), { fitTo: { mode: "width", value: PX_W }, font: FONT_OPTS }).render();
      if (rendered.width !== PX_W || rendered.height !== PX_H) {
        throw new Error(`${dir}/${slide.file}: ${rendered.width}×${rendered.height}, expected ${PX_W}×${PX_H}`);
      }
      // 24-bit RGB: App Store Connect rejects screenshots with an alpha channel.
      const png = toRgbPng(rendered);
      fs.writeFileSync(path.join(OUT, dir, `${slide.file}.png`), png);
      console.log(`${dir}/${slide.file}.png  ${rendered.width}x${rendered.height}  ${Math.round(png.length / 1024)} KB`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

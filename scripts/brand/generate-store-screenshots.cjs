/**
 * Builds the Play Store phone screenshots from the web page's screens section.
 *
 * Same images (web/assets/screens/), same phone frame and same caption style
 * as web/index.html: a mono gold label, a bold title and a muted line, above a
 * centred phone that is shown in full. The background is the app's ambient
 * dot grid and gold light.
 *
 *   npm run brand:store
 *
 * Outputs: assets/store/screenshots/NN-name.png, 1080×1920, 24-bit PNG.
 *
 * To change a screen, replace its image in web/assets/screens/ (the web page
 * then shows it too) and rerun. Keep captions in step with web/index.html.
 */
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { toRgbPng } = require("./png.cjs");

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "web/assets/screens");
const OUT = path.join(ROOT, "assets/store/screenshots");
const FONTS = path.join(ROOT, "node_modules/@expo-google-fonts");

// Palette — mirrors web/index.html and constants/theme.ts.
const BG = "#0a0a0a";
const TEXT = "#f8f8f6";
const MUTED = "#a3a39c";
const GOLD = "#eecd2b";
const LINE_STRONG = "rgba(248,248,246,0.16)";

const W = 1080;
const H = 1920;

// The web page's .phone at store size: aspect 720 / 1458, 7px padding, 32px
// radius and 26px screen radius at 250px wide, all scaled by the same factor.
const PHONE_H = 1290;
const PHONE_W = Math.round((PHONE_H * 720) / 1458);
const K = PHONE_W / 250;
const PAD = Math.round(7 * K);
const RADIUS = Math.round(32 * K);
const SCREEN_RADIUS = Math.round(26 * K);
const PHONE_X = Math.round((W - PHONE_W) / 2);
const PHONE_Y = 560;

// Captions are the web page's figcaptions: <i> label, <b> title, <span> line.
// Order puts the backwards clue first, since the first screenshot is the one
// most people see; lines are split by hand so they wrap cleanly.
const SLIDES = [
  { file: "01-solve", image: "solving", label: "Solve", title: "Four directions, one arrow", line: ["Switch direction with a tap.", "Hints are there if you need them."] },
  { file: "02-home", image: "home", label: "Home", title: "Today's Daily Challenge", line: ["Always free, always waiting at the top."] },
  { file: "03-collection", image: "collection", label: "Collection", title: "Pick your size and difficulty", line: ["Filter the day's set from Easy to Expert,", "6×6 to 12×12."] },
  { file: "04-score", image: "solved", label: "Score", title: "Graded on how you solved it", line: ["Time, accuracy and hints used", "turn into points and coins."] },
  { file: "05-takeaway", image: "takeaway", label: "Takeaway", title: "A short read to finish", line: ["Each puzzle ends with a paragraph", "that ties its answers together."] },
  { file: "06-sign-in", image: "welcome", label: "Sign in", title: "One account, every device", line: ["Google or an emailed code.", "Your streak and coins follow you."] },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function radial(id, cx, cy, r, color, opacity) {
  return [
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>` +
      `<stop offset="0.45" stop-color="${color}" stop-opacity="${opacity * 0.42}"/>` +
      `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
    `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="url(#${id})"/>`,
  ];
}

function slideSvg(slide) {
  const img = fs.readFileSync(path.join(SRC, `${slide.image}.jpg`)).toString("base64");
  const defs = [];
  let body = `<rect width="${W}" height="${H}" fill="${BG}"/>`;

  // Ambient light, then the dot grid, then fog so the grid fades at the edges.
  for (const [d, e] of [radial("gGold", W / 2, 1180, 820, GOLD, 0.11), radial("gTop", W / 2, 160, 700, GOLD, 0.05)]) {
    defs.push(d);
    body += e;
  }
  defs.push(
    `<pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="1.7" fill="${TEXT}" fill-opacity="0.12"/></pattern>`,
    `<radialGradient id="fog" cx="${W / 2}" cy="1000" r="1250" gradientUnits="userSpaceOnUse"><stop offset="0.3" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity="1"/></radialGradient>`,
  );
  body += `<rect width="${W}" height="${H}" fill="url(#dots)"/><rect width="${W}" height="${H}" fill="url(#fog)"/>`;

  // Caption, centred like the phone.
  const cx = W / 2;
  body += `<text x="${cx}" y="160" text-anchor="middle" font-family="Space Mono" font-size="30" letter-spacing="4.8" fill="${GOLD}">${esc(slide.label.toUpperCase())}</text>`;
  body += `<text x="${cx}" y="256" text-anchor="middle" font-family="Manrope" font-weight="800" font-size="70" letter-spacing="-1.4" fill="${TEXT}">${esc(slide.title)}</text>`;
  slide.line.forEach((l, i) => {
    body += `<text x="${cx}" y="${336 + i * 52}" text-anchor="middle" font-family="Manrope" font-weight="500" font-size="38" fill="${MUTED}">${esc(l)}</text>`;
  });

  // The phone: the web page's frame and shadows, image covering the screen
  // from the top (object-fit: cover; object-position: top).
  const sx = PHONE_X + PAD;
  const sy = PHONE_Y + PAD;
  const sw = PHONE_W - PAD * 2;
  const sh = PHONE_H - PAD * 2;
  defs.push(
    `<filter id="shadow" x="-50%" y="-30%" width="200%" height="170%"><feGaussianBlur stdDeviation="46"/></filter>`,
    `<filter id="glow" x="-50%" y="-30%" width="200%" height="170%"><feGaussianBlur stdDeviation="56"/></filter>`,
    `<clipPath id="screen"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${SCREEN_RADIUS}"/></clipPath>`,
  );
  // The web front phone's box-shadow: a gold glow and a deep black drop shadow.
  body += `<rect x="${PHONE_X + 20}" y="${PHONE_Y + 90}" width="${PHONE_W - 40}" height="${PHONE_H - 60}" rx="${RADIUS}" fill="${GOLD}" fill-opacity="0.22" filter="url(#glow)"/>`;
  body += `<rect x="${PHONE_X + 30}" y="${PHONE_Y + 100}" width="${PHONE_W - 60}" height="${PHONE_H - 80}" rx="${RADIUS}" fill="#000" fill-opacity="0.9" filter="url(#shadow)"/>`;
  body += `<rect x="${PHONE_X}" y="${PHONE_Y}" width="${PHONE_W}" height="${PHONE_H}" rx="${RADIUS}" fill="#050505" stroke="${LINE_STRONG}" stroke-width="3"/>`;
  body += `<rect x="${PHONE_X + 4}" y="${PHONE_Y + 4}" width="${PHONE_W - 8}" height="${PHONE_H - 8}" rx="${RADIUS - 4}" fill="none" stroke="#fff" stroke-opacity="0.04" stroke-width="2"/>`;
  body += `<image x="${sx}" y="${sy}" width="${sw}" height="${sh}" preserveAspectRatio="xMidYMin slice" clip-path="url(#screen)" href="data:image/jpeg;base64,${img}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join("")}</defs>${body}</svg>`;
}

function main() {
  // Clear anything from earlier layouts, so only this set can be uploaded.
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const fontFiles = [
    "manrope/500Medium/Manrope_500Medium.ttf",
    "manrope/800ExtraBold/Manrope_800ExtraBold.ttf",
    "space-mono/400Regular/SpaceMono_400Regular.ttf",
  ].map((f) => path.join(FONTS, f));
  for (const slide of SLIDES) {
    const rendered = new Resvg(slideSvg(slide), {
      fitTo: { mode: "width", value: W },
      font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Manrope" },
    }).render();
    // 24-bit RGB: Play rejects screenshots with an alpha channel.
    const png = toRgbPng(rendered);
    fs.writeFileSync(path.join(OUT, `${slide.file}.png`), png);
    console.log(`${slide.file}.png  ${W}x${H}  ${Math.round(png.length / 1024)} KB`);
  }
}

if (require.main === module) main();

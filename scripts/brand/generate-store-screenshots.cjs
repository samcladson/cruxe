/**
 * Builds the store phone screenshots from the web page's screens section.
 *
 * Same images (web/assets/screens/), same phone frame and same caption style
 * as web/index.html: a mono gold label, a bold title and a muted line, above a
 * centred phone that is shown in full. The background is the app's ambient
 * dot grid and gold light.
 *
 *   npm run brand:store        Play Store  → assets/store/screenshots/       1080×1920
 *   npm run brand:store:ios    App Store   → assets/store/screenshots-ios/   1320×2868
 *
 * 24-bit PNG both ways. 1320×2868 is Apple's 6.9" iPhone size, which is the
 * only iPhone set App Store Connect requires now that supportsTablet is false.
 *
 * To change a screen, replace its image in web/assets/screens/ (the web page
 * then shows it too) and rerun. Keep captions in step with web/index.html.
 *
 * iPhone captures: a file in assets/store/ios-captures/ with the same name as
 * a web screen (welcome.jpg, home.jpg, …) is used instead of it for the iOS
 * set. The sign-in slide is only in the iOS set if such a capture exists,
 * because the shared welcome screen shows Google alone, and an iPhone listing
 * should show the Sign in with Apple button Apple's own rules require.
 */
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const { toRgbPng } = require("./png.cjs");

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "web/assets/screens");
const IOS_CAPTURES = path.join(ROOT, "assets/store/ios-captures");
const FONTS = path.join(ROOT, "node_modules/@expo-google-fonts");

// Palette — mirrors web/index.html and constants/theme.ts.
const BG = "#0a0a0a";
const TEXT = "#f8f8f6";
const MUTED = "#a3a39c";
const GOLD = "#eecd2b";
const LINE_STRONG = "rgba(248,248,246,0.16)";

// Every layout number below is in a 1080-wide design space. A profile only
// changes the canvas height and where the phone sits; the SVG is then rendered
// at the profile's real pixel width, so the design scales cleanly.
const W = 1080;

const PROFILES = {
  play: {
    dir: "assets/store/screenshots",
    px: [1080, 1920],
    phoneH: 1290,
    phoneY: 560,
    goldY: 1180,
    fogY: 1000,
  },
  ios: {
    dir: "assets/store/screenshots-ios",
    px: [1320, 2868],
    phoneH: 1600,
    phoneY: 600,
    // The light sits at the phone's middle-upper part, as on the Play set.
    goldY: 600 + 1600 * 0.48,
    fogY: 600 + 1600 * 0.34,
  },
};

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

// The web page's .phone at store size: aspect 720 / 1458, 7px padding, 32px
// radius and 26px screen radius at 250px wide, all scaled by the same factor.
function phoneMetrics(profile) {
  const PHONE_H = profile.phoneH;
  const PHONE_W = Math.round((PHONE_H * 720) / 1458);
  const K = PHONE_W / 250;
  return {
    PHONE_H,
    PHONE_W,
    PAD: Math.round(7 * K),
    RADIUS: Math.round(32 * K),
    SCREEN_RADIUS: Math.round(26 * K),
    PHONE_X: Math.round((W - PHONE_W) / 2),
    PHONE_Y: profile.phoneY,
  };
}

function imagePath(slide, platform) {
  if (platform === "ios") {
    const capture = path.join(IOS_CAPTURES, `${slide.image}.jpg`);
    if (fs.existsSync(capture)) return capture;
  }
  return path.join(SRC, `${slide.image}.jpg`);
}

function slideSvg(slide, profile, platform) {
  const { PHONE_H, PHONE_W, PAD, RADIUS, SCREEN_RADIUS, PHONE_X, PHONE_Y } = phoneMetrics(profile);
  // Design height keeps the pixel aspect ratio: 1080 wide × (h / w).
  const H = (W * profile.px[1]) / profile.px[0];
  const img = fs.readFileSync(imagePath(slide, platform)).toString("base64");
  const defs = [];
  let body = `<rect width="${W}" height="${H}" fill="${BG}"/>`;

  // Ambient light, then the dot grid, then fog so the grid fades at the edges.
  for (const [d, e] of [radial("gGold", W / 2, profile.goldY, 820, GOLD, 0.11), radial("gTop", W / 2, 160, 700, GOLD, 0.05)]) {
    defs.push(d);
    body += e;
  }
  defs.push(
    `<pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="1.7" fill="${TEXT}" fill-opacity="0.12"/></pattern>`,
    `<radialGradient id="fog" cx="${W / 2}" cy="${profile.fogY}" r="1250" gradientUnits="userSpaceOnUse"><stop offset="0.3" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity="1"/></radialGradient>`,
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

// The sign-in slide shows the welcome screen, which differs per platform.
function slidesFor(platform) {
  if (platform !== "ios") return SLIDES;
  return SLIDES.filter(
    (s) => s.image !== "welcome" || fs.existsSync(path.join(IOS_CAPTURES, "welcome.jpg")),
  ).map((s) =>
    s.image === "welcome"
      ? { ...s, line: ["Apple, Google or an emailed code.", "Your streak and coins follow you."] }
      : s,
  );
}

function main() {
  const platform = process.argv[2] === "ios" ? "ios" : "play";
  const profile = PROFILES[platform];
  const [PX_W, PX_H] = profile.px;
  const OUT = path.join(ROOT, profile.dir);
  // Clear anything from earlier layouts, so only this set can be uploaded.
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const fontFiles = [
    "manrope/500Medium/Manrope_500Medium.ttf",
    "manrope/800ExtraBold/Manrope_800ExtraBold.ttf",
    "space-mono/400Regular/SpaceMono_400Regular.ttf",
  ].map((f) => path.join(FONTS, f));
  for (const slide of slidesFor(platform)) {
    const rendered = new Resvg(slideSvg(slide, profile, platform), {
      fitTo: { mode: "width", value: PX_W },
      font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Manrope" },
    }).render();
    // 24-bit RGB: both stores reject screenshots with an alpha channel.
    const png = toRgbPng(rendered);
    fs.writeFileSync(path.join(OUT, `${slide.file}.png`), png);
    console.log(`${slide.file}.png  ${rendered.width}x${rendered.height}  ${Math.round(png.length / 1024)} KB`);
  }
}

if (require.main === module) main();

/**
 * The iPhone frame shared by the App Store screenshots and creative assets.
 *
 * Captures live in assets/store/ios-captures/ (1242×2688, from an iPhone 11
 * Pro Max) and are shown exactly as taken: whole, upright, uncropped.
 */
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp-compact");

const ROOT = path.resolve(__dirname, "../..");
const CAPTURES = path.join(ROOT, "assets/store/ios-captures");

// Capture size: an iPhone 11 Pro Max at 3×.
const CW = 1242;
const CH = 2688;

const GOLD = "#eecd2b";

let uid = 0;
const nextId = (p) => `${p}${++uid}`;

async function loadCapture(name) {
  const file = path.join(CAPTURES, `${name}.jpg`);
  const { width, height } = (await Jimp.read(file)).bitmap;
  if (width !== CW || height !== CH) {
    throw new Error(`${name}.jpg is ${width}×${height}; captures must be ${CW}×${CH}`);
  }
  return `data:image/jpeg;base64,${fs.readFileSync(file).toString("base64")}`;
}

function phoneGeometry(w) {
  const b = Math.round(w * 0.034);
  const sw = w - 2 * b;
  const sh = Math.round((sw * CH) / CW);
  return { b, sw, sh, h: sh + 2 * b };
}

/**
 * A modern iPhone around a capture: titanium band, black bezel, side buttons
 * and a Dynamic Island that sits in the status bar's empty middle. The screen
 * keeps the capture's aspect ratio, so nothing in it is cropped or stretched.
 */
function phone(cap, { x, y, w, glow = true }) {
  const { b, sw, h } = phoneGeometry(w);
  const sr = sw * 0.132;
  const R = sr + b;
  const k = sw / CW;
  const id = nextId("screen");

  let s = "";
  if (glow) s += `<rect x="${x + 60}" y="${y + 160}" width="${w - 120}" height="${h - 260}" rx="${R}" fill="${GOLD}" fill-opacity="0.16" filter="url(#bigGlow)"/>`;
  s += `<rect x="${x + 30}" y="${y + 70}" width="${w - 60}" height="${h - 40}" rx="${R}" fill="#000" fill-opacity="0.9" filter="url(#bigShadow)"/>`;
  // Side buttons, drawn first so the band overlaps them.
  const btn = (bx, frac, len) =>
    `<rect x="${bx}" y="${y + h * frac}" width="${b * 0.7}" height="${h * len}" rx="${b * 0.3}" fill="url(#btn)"/>`;
  s += btn(x - b * 0.32, 0.17, 0.035) + btn(x - b * 0.32, 0.235, 0.07) + btn(x - b * 0.32, 0.32, 0.07);
  s += btn(x + w - b * 0.38, 0.26, 0.105);
  // Band, bezel, screen.
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}" fill="url(#titanium)"/>`;
  s += `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="${R - 2}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="2"/>`;
  s += `<rect x="${x + b * 0.3}" y="${y + b * 0.3}" width="${w - b * 0.6}" height="${h - b * 0.6}" rx="${R - b * 0.3}" fill="#000"/>`;
  s += `<clipPath id="${id}"><rect width="${CW}" height="${CH}" rx="${sr / k}"/></clipPath>`;
  s += `<g transform="translate(${x + b} ${y + b}) scale(${k})"><g clip-path="url(#${id})">`;
  s += `<image width="${CW}" height="${CH}" href="${cap}"/>`;
  s += `<rect x="${CW / 2 - 170}" y="20" width="340" height="98" rx="49" fill="#000"/>`;
  s += `</g></g>`;
  return s;
}

const PHONE_DEFS = [
  `<filter id="bigShadow" x="-50%" y="-30%" width="200%" height="170%"><feGaussianBlur stdDeviation="50"/></filter>`,
  `<filter id="bigGlow" x="-50%" y="-30%" width="200%" height="170%"><feGaussianBlur stdDeviation="110"/></filter>`,
  `<linearGradient id="titanium" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#46453f"/><stop offset="0.035" stop-color="#222220"/><stop offset="0.5" stop-color="#151515"/>` +
    `<stop offset="0.965" stop-color="#222220"/><stop offset="1" stop-color="#46453f"/></linearGradient>`,
  `<linearGradient id="btn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#52514c"/><stop offset="1" stop-color="#1e1e1d"/></linearGradient>`,
];

module.exports = { CW, CH, loadCapture, phone, phoneGeometry, PHONE_DEFS };

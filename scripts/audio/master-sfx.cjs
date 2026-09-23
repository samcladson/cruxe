/**
 * Builds assets/sounds/ from Google's Material Design sound resources.
 *
 *   FFMPEG=path/to/ffmpeg node scripts/audio/master-sfx.cjs
 *
 * (Without FFMPEG set, `ffmpeg` on PATH is used. `npx ffmpeg-static` prints
 * the path of a portable build if there is none installed.)
 *
 * The sources are Google's studio masters (24-bit, 48 kHz), licensed CC BY 4.0
 * — which needs a credit, given in the Terms screen and web/terms.html, and a
 * note that they were modified: this script trims and levels them, nothing
 * more. https://archive.org/details/material-design-sound-resources
 *
 * Why mastering at all: as shipped, the set spans -15 to -41 LUFS, so used
 * raw a hint would be twice as loud as a solve. Every sound here is levelled
 * by its role instead:
 *
 *   taps     peak-normalised, quiet. Too short (<400 ms) for loudness
 *            measurement, and heard dozens of times a puzzle.
 *   tones    integrated loudness, with the moments that matter (a solve, a
 *            streak) loudest and the error tone softest — being wrong should
 *            not be the thing the app shouts about.
 *
 * Taps are written as WAV, because AAC's encoder delay would put ~20 ms of
 * nothing between a finger and its sound. Everything longer is AAC in .m4a,
 * where that delay is inaudible and the file is a tenth of the size.
 */
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const ARCHIVE =
  "https://archive.org/download/material-design-sound-resources/material_product_sounds/wav";
const OUT_DIR = path.join(__dirname, "..", "..", "assets", "sounds");
const CACHE = path.join(os.tmpdir(), "cruxe-material-sounds");

/**
 * name → source and level. The names are what services/soundService.ts
 * requires; change a source here and rerun to swap a sound.
 */
const SOUNDS = [
  // Selecting a cell: the softest of the taps.
  { name: "cell-tap", src: "03 Primary System Sounds/ui_tap-variant-01.wav", peak: -12 },
  // Typing rotates through three takes, so a word does not sound like one
  // sample fired repeatedly.
  { name: "letter-input-1", src: "03 Primary System Sounds/ui_tap-variant-02.wav", peak: -12 },
  { name: "letter-input-2", src: "03 Primary System Sounds/ui_tap-variant-03.wav", peak: -12 },
  { name: "letter-input-3", src: "03 Primary System Sounds/ui_tap-variant-04.wav", peak: -12 },
  // A soft double tap, so a button reads differently from a grid cell.
  { name: "button-tap", src: "03 Primary System Sounds/navigation_forward-selection-minimal.wav", peak: -10 },

  // A check that found nothing wrong.
  { name: "word-complete", src: "02 Alerts and Notifications/notification_simple-02.wav", lufs: -20 },
  // A check that found something: a soft falling tone, not a buzzer.
  { name: "error", src: "04 Secondary System Sounds/alert_error-02.wav", lufs: -22 },
  // Coins spent on a reveal — a hint or a fact.
  { name: "hint", src: "02 Alerts and Notifications/notification_decorative-01.wav", lufs: -21 },
  // Coins landing on the result screen: a small celebration of its own.
  { name: "coin-earned", src: "01 Hero Sounds/hero_simple-celebration-03.wav", lufs: -20 },
  { name: "puzzle-complete", src: "01 Hero Sounds/hero_decorative-celebration-01.wav", lufs: -17 },
  { name: "streak", src: "01 Hero Sounds/hero_decorative-celebration-02.wav", lufs: -17 },
];

/** Nothing may exceed this after gain, so no sound can clip on any device. */
const PEAK_CEILING = -1.5;

function ffmpeg(args) {
  return execFileSync(FFMPEG, ["-hide_banner", "-nostats", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** ffmpeg writes analysis to stderr; run it and hand that back. */
function analyse(file, filter) {
  const r = spawnSync(
    FFMPEG,
    ["-hide_banner", "-nostats", "-i", file, "-af", filter, "-f", "null", "-"],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`analysis failed for ${file}: ${r.stderr}`);
  return r.stderr;
}

function measure(file) {
  const out = analyse(file, "ebur128=peak=true,volumedetect");
  // ebur128 prints a running "I:" on every frame; only the one in its
  // closing summary is the integrated figure.
  const summary = out.slice(out.lastIndexOf("Summary:"));
  const num = (text, re) => {
    const m = text.match(re);
    return m ? parseFloat(m[1]) : NaN;
  };
  return {
    lufs: num(summary, /I:\s+(-?[\d.]+) LUFS/),
    peak: num(out, /max_volume:\s+(-?[\d.]+) dB/),
    duration: num(out, /Duration: 00:00:([\d.]+)/),
  };
}

async function download(src) {
  const file = path.join(CACHE, path.basename(src));
  if (fs.existsSync(file)) return file;
  const res = await fetch(`${ARCHIVE}/${encodeURI(src)}`);
  if (!res.ok) throw new Error(`${res.status} fetching ${src}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

async function master({ name, src, peak, lufs }, outDir = OUT_DIR) {
  const source = await download(src);

  // 1. Gain to the role's level, measured on the untouched source (loudness
  //    gating ignores the silence), never past the ceiling.
  const m = measure(source);
  let gain = peak !== undefined ? peak - m.peak : lufs - m.lufs;
  if (!Number.isFinite(gain)) throw new Error(`${name}: could not measure level`);
  gain = Math.min(gain, PEAK_CEILING - m.peak);

  // 2. Then trim silence at both ends — after the gain, so the thresholds
  //    are against the level the player will hear. Trimmed first, a quiet
  //    source lost tails that became audible once it was brought up.
  //    Leading silence is latency; trailing silence is bytes. The reverse
  //    trick trims the tail with the same filter that trims the head.
  const trimmed = path.join(CACHE, `${name}.trimmed.wav`);
  const chain1 =
    `volume=${gain.toFixed(2)}dB,` +
    "silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.002," +
    "areverse,silenceremove=start_periods=1:start_threshold=-80dB:start_silence=0.02,areverse";
  ffmpeg(["-y", "-i", source, "-af", chain1, "-c:a", "pcm_s24le", trimmed]);

  // 3. A short fade on the tail, so a cut-off never clicks.
  const { duration } = measure(trimmed);
  const fade = Math.min(0.03, duration / 4);
  const chain = `afade=t=out:st=${(duration - fade).toFixed(3)}:d=${fade.toFixed(3)}`;

  const isTap = peak !== undefined;
  const out = path.join(outDir, `${name}.${isTap ? "wav" : "m4a"}`);
  const codec = isTap
    ? ["-af", `${chain},aresample=osf=s16:dither_method=triangular`, "-c:a", "pcm_s16le"]
    : ["-af", chain, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"];
  ffmpeg(["-y", "-i", trimmed, ...codec, "-ar", "48000", out]);

  const result = measure(out);
  console.log(
    `${path.basename(out).padEnd(22)} ${result.duration.toFixed(2)}s  ` +
      `peak ${result.peak.toFixed(1)} dBFS` +
      (result.lufs > -70 ? `  ${result.lufs.toFixed(1)} LUFS` : "") +
      `  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`,
  );
}

fs.mkdirSync(CACHE, { recursive: true });

// Required rather than run, it masters other candidates the same way, so
// they can be auditioned against the chosen ones at matching levels.
module.exports = { master, SOUNDS };

if (require.main === module) {
  (async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const sound of SOUNDS) await master(sound);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

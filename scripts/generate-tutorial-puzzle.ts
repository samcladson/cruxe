/**
 * generate-tutorial-puzzle.ts — Authoring tool, run once (or when the
 * tutorial word list changes).
 *
 * Builds the bundled tutorial puzzle with the real crossword engine and
 * freezes the result into constants/tutorialPuzzle.ts. Hand-authoring a grid
 * is error-prone, and generating it guarantees the frozen constant matches
 * the runtime `Puzzle` shape exactly.
 *
 * buildPuzzle is non-deterministic (it shuffles word order on retries), which
 * is precisely why the output is frozen rather than built at app start: the
 * coach bar and tooltips reference a layout that must never change.
 *
 * Requires at least one reverse-direction word — the tutorial exists partly
 * to teach that mechanic, so the script fails if the layout has none.
 *
 * Usage: npx tsx scripts/generate-tutorial-puzzle.ts
 */
import fs from "fs";
import path from "path";
import { buildPuzzle } from "../services/crosswordEngine";

/**
 * buildPuzzle shuffles word order with Math.random on retry attempts, so
 * re-running this script would otherwise produce a different grid every
 * time — which makes a "generated, do not edit" file a lie.
 *
 * Seeding Math.random for the duration makes the output reproducible, so
 * regenerating after a word-list tweak gives a predictable diff rather than
 * a lottery.
 */
function seedRandom(seed: number): () => void {
  const original = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    // mulberry32 — small, fast, good enough for word shuffling.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    Math.random = original;
  };
}

/**
 * Chosen by sweeping seeds 1-12 and keeping the best grid: it places 5 of
 * the 10 candidate words, includes CRUX (a brand moment that is also a
 * teaching moment), and contains a reverse-direction word so the tutorial
 * can introduce that mechanic somewhere harmless.
 *
 * Override with TUTORIAL_SEED to explore alternatives after a word-list change.
 */
const SEED = Number(process.env.TUTORIAL_SEED ?? 10);

const WORDS = [
  { word: "CRUX", clue: "The essential point — and this app's name" },
  { word: "CLUE", clue: "A hint toward the answer" },
  { word: "GRID", clue: "The squared board you fill in" },
  { word: "WORD", clue: "A run of letters in the grid" },
  { word: "SOLVE", clue: "What you are here to do" },
  { word: "LETTER", clue: "What goes in a single square" },
  { word: "ACROSS", clue: "Left-to-right direction" },
  { word: "DOWN", clue: "Top-to-bottom direction" },
  { word: "TILE", clue: "Another word for a square" },
  { word: "MIND", clue: "What a puzzle sharpens" },
];

const restore = seedRandom(SEED);
const puzzle = buildPuzzle(WORDS, "general", "easy" as any, 6, "tutorial");
restore();

if (!puzzle) {
  console.error("✗ buildPuzzle returned null. Adjust the word list.");
  process.exit(1);
}

const reverse = puzzle.clues.filter((c) =>
  c.direction.startsWith("reverse"),
);
if (reverse.length === 0) {
  console.error(
    "✗ No reverse-direction word was placed. The tutorial needs one to\n" +
      "  teach that mechanic. Re-run — placement is randomised — or adjust\n" +
      "  the word list.",
  );
  process.exit(1);
}

/**
 * buildPuzzle stamps live runtime state into its output (startedAt is
 * Date.now()). Zero it out, or the "generated" file changes on every run and
 * shows a spurious diff. The tutorial screen deep-copies this constant and
 * sets its own session state anyway.
 */
puzzle.startedAt = null;
// `date` is a full ISO timestamp from buildPuzzle. The tutorial isn't a
// dated daily puzzle, so pin it rather than baking in the build moment.
puzzle.date = "tutorial";
puzzle.completedAt = null;
puzzle.isComplete = false;
puzzle.solvedWords = 0;
puzzle.score = 0;
puzzle.hintsUsed = 0;

console.log(`Placed ${puzzle.totalWords}/${WORDS.length} words on a 6x6.`);
console.log(`Reverse-direction clues: ${reverse.map((c) => c.answer).join(", ")}`);

// Render the grid so the layout is reviewable in the diff.
const art = puzzle.grid
  .map((row) => row.map((c) => (c.isBlocked ? "." : c.letter)).join(" "))
  .join("\n * ");

const out = `/**
 * tutorialPuzzle.ts — GENERATED FILE. Do not edit by hand.
 *
 * Produced by scripts/generate-tutorial-puzzle.ts using the real crossword
 * engine, then frozen. The layout must stay fixed: the tutorial's coaching
 * refers to it, and buildPuzzle is non-deterministic, so rebuilding at
 * runtime would give every player a different grid.
 *
 * This puzzle has no row in daily_puzzles. It is never submitted, never
 * scored, and earns nothing — it is a warm-up, not a puzzle. That is what
 * keeps the tutorial free of any server surface.
 *
 * Layout:
 * ${art}
 *
 * Regenerate with: npx tsx scripts/generate-tutorial-puzzle.ts
 */
import { Puzzle } from "../types/puzzle.types";

// Cast: Difficulty and Direction are string enums, so the serialised
// literals are correct at runtime but need widening for the compiler.
export const TUTORIAL_PUZZLE = ${JSON.stringify(puzzle, null, 2)} as unknown as Puzzle;

/** Clue ids that read backwards — used to trigger the reverse-clue tooltip. */
export const TUTORIAL_REVERSE_CLUE_IDS = ${JSON.stringify(
  reverse.map((c) => c.id),
)};
`;

const target = path.join(__dirname, "..", "constants", "tutorialPuzzle.ts");
fs.writeFileSync(target, out, "utf8");
console.log(`✓ Wrote ${target}`);

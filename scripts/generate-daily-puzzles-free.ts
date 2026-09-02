/**
 * generate-daily-puzzles-free.ts — Free Tier daily puzzle generation script.
 * 
 * Specifically designed to respect Gemini 2.5 Flash Free Tier limits (5 RPM, 20 RPD).
 * Instead of generating 101 puzzles per day, this generates exactly 19 puzzles per day,
 * rotating through 80 grid/difficulty combinations across a 4-5 day cycle so players
 * always get fresh content without hitting API error 429.
 *
 * Runs in GitHub Actions.
 *
 * Usage:
 *   npx tsx scripts/generate-daily-puzzles-free.ts [YYYY-MM-DD]
 *
 * Required environment variables:
 *   SUPABASE_URL           — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key for DB writes
 *   GEMINI_API_KEY         — Google Gemini API key
 */

import { createClient } from "@supabase/supabase-js";
import { buildPuzzle } from "../services/crosswordEngine";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries a Gemini call on rate limits and transient server errors.
 *
 * The free tier allows 5 requests per minute, so a burst reliably 429s. That
 * used to lose the puzzle outright; waiting a few seconds converts a lost
 * puzzle into a slow one. Non-retryable failures (a bad prompt, an auth
 * error) still fail immediately rather than burning the daily quota.
 */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!(err as any)?.retryable || i === attempts - 1) throw err;
      const wait = 15000 * (i + 1); // 15s, then 30s - clears a 5 RPM window
      console.warn(
        `   Retrying ${label} in ${wait / 1000}s (${i + 1}/${attempts - 1}): ` +
          `${(err as Error).message.substring(0, 80)}`,
      );
      await delay(wait);
    }
  }
  throw lastErr;
}

/**
 * A run that produces almost nothing is a failure, even though it produced
 * something. Below this fraction of the planned puzzles, exit non-zero so the
 * Action goes red and you find out from GitHub rather than from an empty app.
 */
const MIN_SUCCESS_RATIO = 0.7;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

type Category =
  | "general"
  | "history"
  | "technology"
  | "entertainment"
  | "sports"
  | "daily_challenge";
type Difficulty = "easy" | "medium" | "hard" | "expert";
type GridSize = 6 | 8 | 10 | 12;
type Direction = "across" | "down" | "reverse_across" | "reverse_down";

interface GeneratedClue {
  word: string;
  clue: string;
  isHint: boolean;
}

interface PuzzleWord {
  word: string;
  clue: string;
  isHint: boolean;
}

/** A grid cell as persisted. Mirrors StoredCell in functions/_shared/grid.ts
 *  plus the render-only fields the client needs. */
interface StoredGridCell {
  letter: string | null;
  isBlocked: boolean;
  isPreFilled: boolean;
  clueNumbers: number[];
  clueIds: string[];
}

interface DailyPuzzleData {
  words: PuzzleWord[];
  /** The built grid. Present from migration 008 onward; absent on legacy rows. */
  grid: StoredGridCell[][];
  clues: unknown[];
  metadata: {
    date?: string;
    category: Category;
    difficulty: Difficulty;
    gridSize: GridSize;
    isDailyChallenge: boolean;
    estimatedTime: number;
    totalWords: number;
  };
}

interface PuzzleSpec {
  category: Category;
  difficulty: Difficulty;
  gridSize: GridSize;
  variant: number;
  isDailyChallenge: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const GRID_SIZES: Record<
  GridSize,
  { maxWords: number; maxWordLength: number }
> = {
  6: { maxWords: 14, maxWordLength: 6 },
  8: { maxWords: 22, maxWordLength: 8 },
  10: { maxWords: 32, maxWordLength: 10 },
  12: { maxWords: 44, maxWordLength: 12 },
};

// ═══════════════════════════════════════════════════════════════════
// GEMINI SERVICE
// ═══════════════════════════════════════════════════════════════════

/**
 * Generates crossword words and clues via the Gemini 2.5 Flash REST API.
 *
 * Uses a date-aware, quality-enforced prompt identical in logic to the in-app
 * geminiService.ts — ensuring daily pre-generated puzzles feel as fresh and
 * culturally relevant as on-demand premium puzzles.
 *
 * No Google Search grounding is used — zero extra cost, free-tier safe.
 *
 * @param category  - Puzzle category (e.g. "technology", "sports")
 * @param difficulty - Puzzle difficulty level
 * @param gridSize  - Size of the crossword grid (6, 8, 10, or 12)
 * @param apiKey    - Gemini API key
 * @param today     - ISO date string (YYYY-MM-DD) injected into the prompt
 * @returns Array of GeneratedClue objects ready for database storage
 */
async function generatePuzzleWords(
  category: string,
  difficulty: Difficulty,
  gridSize: GridSize,
  apiKey: string,
  today: string,
): Promise<GeneratedClue[]> {
  const settings = GRID_SIZES[gridSize];
  const wordCount = settings.maxWords;
  const maxLength = settings.maxWordLength;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // Identical prompt logic to geminiService.ts — date-aware, quality-enforced
  const prompt = `You are the puzzle editor of an award-winning crossword publication renowned for \
puzzles that feel sharp, current, and culturally alive — the kind solvers share because a clue \
made them groan and grin at the same time.

Today's date: ${today}
Category: ${category}
Grid: ${gridSize}×${gridSize} | Words needed: ${wordCount} | Max word length: ${maxLength} letters

━━━ FRESHNESS & RELEVANCE ━━━
Draw on your knowledge of what is currently trending, talked-about, and culturally significant \
in the "${category}" space as of ${today}.
Think: recent events, people in the news, viral moments, award winners, record-breakers, product \
launches, chart-toppers, ongoing storylines, notable headlines, breakthrough moments.
At least 40% of words should connect to something that feels zeitgeist-relevant right now.

━━━ WORD QUALITY — ZERO TOLERANCE POLICY ━━━
PERMANENTLY BANNED crossword filler (never use these or anything of this character):
ERA, ORE, OLE, ALE, SEA, ARIA, ETNA, ABET, ALOE, OLEO, EROS, ESNE, ANEW, ONES,
INANE, ATONE, EIRE, ERNE, ALEE, NENE, ELSE, ALEC, YORE, IAMB, NARC, TSAR, OTIC.
If a word feels stale, dusty, or "crossword-y" without real-world weight — replace it.

Every word must be vivid, specific, and carry cultural or contextual weight.
Prefer: proper nouns, sharp verbs, evocative concrete nouns, acronyms with currency.
Avoid: vague abstractions, generic adjectives, purely archaic or obscure Latin.

━━━ DIFFICULTY: ${difficulty} ━━━
  Easy   → Widely known vocabulary. Direct definitions. The solver should feel smart
            and rewarded — never stumped by the word itself, only delighted by the clue.
  Medium → Mix of familiar and slightly niche terms. Clues use gentle misdirection,
            double meanings, or light wordplay. One small "aha" moment per clue.
  Hard   → Niche vocabulary requiring specific knowledge. Cryptic-adjacent clues that
            mislead on first reading and reward on reflection. Surface and solution differ.
  Expert → Deep cultural cuts and cross-domain wordplay that separates casual solvers
            from enthusiasts. Clues are elegant traps — precise, layered, fair but fiendish.

━━━ GRID CONSTRAINTS ━━━
- Word lengths: 3 to ${maxLength} letters. Actively MIX lengths: short (3-4), medium (5-6), long (7+).
- Maximise grid interlocking by favouring letters: E, A, R, S, T, N, O, I.
- ALL WORDS: UPPERCASE, A-Z only, absolutely no spaces, hyphens, or punctuation.

━━━ CLUE RULES ━━━
- Maximum 65 characters per clue.
- Never use the answer word or a direct synonym anywhere in the clue.
- Exactly one unambiguous correct answer — no clue should allow two valid solutions.
- Hard and Expert clues must have a surface reading that misleads before the aha lands.
- Easy and Medium clues should feel satisfying, not frustrating.

━━━ HINTS (isHint: true) ━━━
Mark exactly 2-3 words as isHint true. These become pre-revealed letters to help players
get a foothold in the grid. Choose short (3-5 letter), common-letter words strategically —
never your most interesting or thematic words.

Return a JSON array of exactly ${wordCount} objects. No markdown, no extra text.`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.95,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              word: {
                type: "STRING",
                description: "The crossword answer word. UPPERCASE, A-Z only, no spaces or hyphens."
              },
              clue: {
                type: "STRING",
                description: "A clever, concise crossword clue. Max 65 characters."
              },
              isHint: {
                type: "BOOLEAN",
                description: "True for exactly 2-3 short, common-letter words chosen to help players get a grid foothold."
              }
            },
            required: ["word", "clue", "isHint"]
          }
        }
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // 429 is the free tier's 5-requests-per-minute limit and is entirely
    // expected during a burst; 5xx is transient. Both were previously fatal
    // for that puzzle, turning a moment's throttling into missing content.
    // The caller retries these with backoff.
    const retryable = response.status === 429 || response.status >= 500;
    const err = new Error(
      `Gemini API error (${response.status}): ${errorText.substring(0, 200)}`,
    );
    (err as any).retryable = retryable;
    throw err;
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error("Gemini returned empty response");

  let parsedArray: any[] = [];
  try {
    // Attempt standard JSON parsing first, which works 99% of the time with responseSchema
    parsedArray = JSON.parse(responseText);
    if (!Array.isArray(parsedArray)) {
      parsedArray = [];
    }
  } catch (err) {
    // Fallback: Robustly extract JSON objects from raw response using regex if JSON is malformed
    const objectRegex = /\{[^{}]*"(?:word|answer)"\s*:\s*"([^"]+)"[^{}]*"clue"\s*:\s*"([^"]+)"(?:[^{}]*"isHint"\s*:\s*(true|false))?[^{}]*\}/g;
    let match;
    while ((match = objectRegex.exec(responseText)) !== null) {
      parsedArray.push({
        word: match[1],
        clue: match[2],
        isHint: match[3] === "true",
      });
    }
  }

  const extractedWords: GeneratedClue[] = [];
  for (const item of parsedArray) {
    // Handle cases where Gemini uses "answer" instead of "word" despite schema
    const rawWord = item.word || item.answer;
    if (!rawWord || typeof rawWord !== "string") continue;
    
    const word = rawWord.toUpperCase().replace(/[^A-Z]/g, "");
    if (word.length < 3 || word.length > maxLength) continue;
    if (typeof item.clue !== "string" || item.clue.trim().length < 3) continue;

    // A clue that contains its own answer gives the puzzle away. LLMs do this
    // often enough that it is worth rejecting rather than shipping.
    if (item.clue.toUpperCase().includes(word)) {
      console.warn(`   ⚠ Dropped "${word}" - the clue contains the answer`);
      continue;
    }

    // Duplicate answers break the grid: two clues would resolve to the same
    // cells and the puzzle becomes unsolvable as written.
    if (extractedWords.some((w) => w.word === word)) {
      console.warn(`   ⚠ Dropped duplicate answer "${word}"`);
      continue;
    }

    extractedWords.push({
      word,
      clue: item.clue.trim(),
      isHint: Boolean(item.isHint),
    });
  }

  if (extractedWords.length === 0) {
    console.warn(
      `[JSON Parse Error] Raw text:\n${responseText.substring(0, 400)}...`,
    );
    throw new Error(
      "Could not extract any valid word objects from Gemini response",
    );
  }

  return extractedWords.slice(0, wordCount);
}

// ═══════════════════════════════════════════════════════════════════
// MANIFEST — 19 PUZZLES PER DAY (ROTATING)
// ═══════════════════════════════════════════════════════════════════

function getDayOfYear(dateStr: string): number {
  const date = new Date(dateStr);
  const start = new Date(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function buildRotatingManifest(targetDate: string): PuzzleSpec[] {
  const specs: PuzzleSpec[] = [];
  const dayOfYear = getDayOfYear(targetDate);

  const categories: Category[] = [
    "general",
    "history",
    "technology",
    "entertainment",
    "sports",
  ];

  const possibleGridSizes: GridSize[] = [6, 8, 10, 12];
  const possibleDifficulties: Difficulty[] = ["easy", "medium", "hard", "expert"];

  // ── 15 rotating category puzzles (3 per category) ────────────────────────
  // Generated FIRST so they always land in the DB even if the last call fails.
  categories.forEach((category, i) => {
    for (let slot = 0; slot < 3; slot++) {
      const diffIndex = (dayOfYear + i + slot) % possibleDifficulties.length;
      const gridIndex = (dayOfYear + i * 2 + slot) % possibleGridSizes.length;
      specs.push({
        category,
        difficulty: possibleDifficulties[diffIndex],
        gridSize: possibleGridSizes[gridIndex],
        variant: 1,
        isDailyChallenge: false,
      });
    }
  });

  // ── 3 rotating wildcard puzzles ──────────────────────────────────────────
  for (let slot = 0; slot < 3; slot++) {
    const catIndex = (dayOfYear * 7 + slot) % categories.length;
    const diffIndex = (dayOfYear * 3 + slot) % possibleDifficulties.length;
    const gridIndex = (dayOfYear * 5 + slot) % possibleGridSizes.length;
    specs.push({
      category: categories[catIndex],
      difficulty: possibleDifficulties[diffIndex],
      gridSize: possibleGridSizes[gridIndex],
      variant: 2,
      isDailyChallenge: false,
    });
  }

  // ── 1 dedicated Daily Challenge — always LAST ───────────────────────────
  // Placed at the end of the queue so all 18 category puzzles are safely
  // generated before this call is made. Stored with is_daily_challenge=true
  // directly in the upsert — no separate UPDATE/promotion step required.
  // Fixed format: general / medium / 10×10 / variant 1.
  specs.push({
    category: "general",
    difficulty: "medium",
    gridSize: 10,
    variant: 1,
    isDailyChallenge: true,
  });

  return specs; // 19 total: 18 category + 1 daily challenge (under 20 RPD free-tier limit)
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();

  // Parse target date from CLI argument, or default to TODAY (UTC).
  // When run manually, generates immediately-available puzzles.
  // The GitHub Actions cron handles the 3-day buffer by calling this script
  // with explicit dates for today, tomorrow, and day-after-tomorrow.
  const today = new Date();
  const targetDate = process.argv[2] || today.toISOString().split("T")[0];

  console.log(`\n🎲 Cruxe Daily Puzzle Generator`);
  console.log(`📅 Target Date: ${targetDate}`);
  console.log(`🕐 Current UTC: ${today.toISOString()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Validate environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl) {
    console.error("❌ Missing SUPABASE_URL");
    process.exit(1);
  }
  if (!supabaseKey) {
    console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!geminiKey) {
    console.error("❌ Missing GEMINI_API_KEY");
    process.exit(1);
  }

  console.log(`✅ Environment variables loaded`);
  console.log(`   Supabase: ${supabaseUrl.substring(0, 35)}...`);

  // Init Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Build manifest
  const manifest = buildRotatingManifest(targetDate);
  console.log(`📋 Manifest: ${manifest.length} puzzles (18 category + 1 daily challenge)\n`);

  // Check existing puzzles
  const { data: existing, error: fetchError } = await supabase
    .from("daily_puzzles")
    .select("category, difficulty, grid_size, variant")
    .eq("puzzle_date", targetDate);

  if (fetchError) {
    console.error(`❌ Failed to query existing puzzles: ${fetchError.message}`);
    process.exit(1);
  }

  const existingSet = new Set(
    (existing || []).map(
      (e: Record<string, unknown>) =>
        `${e.category}|${e.difficulty}|${e.grid_size}|${e.variant}`,
    ),
  );

  const missing = manifest.filter(
    (spec) =>
      !existingSet.has(
        `${spec.category}|${spec.difficulty}|${spec.gridSize}|${spec.variant}`,
      ),
  );

  console.log(
    `📊 Status: ${existing?.length || 0} exist, ${missing.length} to generate\n`,
  );

  if (missing.length === 0) {
    console.log("✅ All puzzles already generated for today!");
    process.exit(0);
  }

  // Generate missing puzzles
  let generated = 0,
    errors = 0;
  const errorDetails: string[] = [];

  // For the Free Tier, we DO NOT use Promise.all. 
  // We process sequentially, adding a strict 15-second delay to guarantee we stay below 5 RPM.
  for (let i = 0; i < missing.length; i++) {
    const spec = missing[i];
    const label = `[${i + 1}/${missing.length}] ${spec.category}/${spec.difficulty}/${spec.gridSize}x${spec.gridSize}/v${spec.variant}`;
    
    console.log(`\n⏳ Generating: ${label}`);

    try {
      const geminiCategory = spec.isDailyChallenge
        ? "mixed general knowledge spanning history, science, pop culture, geography, sports, and everyday life"
        : spec.category;

      // Generate words via Gemini (targetDate injected for freshness context)
      const words = await withRetry(label, () =>
        generatePuzzleWords(
          geminiCategory,
          spec.difficulty,
          spec.gridSize,
          geminiKey,
          targetDate,
        ),
      );
      if (words.length < 3)
        throw new Error(`Only ${words.length} words returned`);

      // Build the grid once, HERE, so every player gets the identical layout
      // and the server can verify submissions against a known answer key.
      // buildPuzzle uses Math.random() on retry attempts, so building it on
      // each client would give every player a different puzzle.
      const built = buildPuzzle(
        words,
        geminiCategory as any,
        spec.difficulty as any,
        spec.gridSize as any,
        undefined,
      );
      if (!built) {
        throw new Error("Grid construction failed");
      }

      const puzzleData: DailyPuzzleData = {
        words,
        grid: built.grid.map((row) =>
          row.map((c) => ({
            letter: c.letter,
            isBlocked: c.isBlocked,
            isPreFilled: c.isPreFilled,
            clueNumbers: c.clueNumbers,
            clueIds: c.clueIds,
          })),
        ),
        clues: built.clues,
        metadata: {
          category: spec.category,
          difficulty: spec.difficulty,
          gridSize: spec.gridSize,
          isDailyChallenge: spec.isDailyChallenge,
          estimatedTime: built.estimatedTime,
          totalWords: built.totalWords,
          date: targetDate,
        },
      };

      // Store the built grid alongside the words
      const { error: insertError } = await supabase
        .from("daily_puzzles")
        .upsert(
          {
            puzzle_date: targetDate,
            category: spec.category,
            difficulty: spec.difficulty,
            grid_size: spec.gridSize,
            variant: spec.variant,
            is_daily_challenge: spec.isDailyChallenge,
            puzzle_data: puzzleData,
            total_words: built.totalWords,
            estimated_time: built.estimatedTime,
          },
          { onConflict: "puzzle_date,category,difficulty,grid_size,variant" },
        );

      if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

      generated++;
      console.log(
        ` ✅ Success: ${built.totalWords}/${words.length} words placed on a ` +
          `${spec.gridSize}×${spec.gridSize} grid`,
      );
    } catch (err) {
      errors++;
      const errMsg = err instanceof Error ? err.message : String(err);
      errorDetails.push(`${label}: ${errMsg}`);
      console.error(` ❌ Error: ${errMsg}`);
    }

    // Rate Limit Throttle: Wait 15.5 seconds between requests (roughly ~3.8 Requests Per Minute)
    // Only hit the delay if there are still puzzles left to generate
    if (i < missing.length - 1) {
      console.log(`   ⏱️  Throttling APIs: Sleeping for 15.5 seconds to respect 5 RPM limit...`);
      await delay(15500); 
    }
  }

  // Step 4: Cleanup old puzzles (older than 30 days)
  console.log(`\n🧹 Starting cleanup of old puzzles...`);
  try {
    const retentionDays = 30;
    const thresholdDate = new Date();
    thresholdDate.setUTCDate(thresholdDate.getUTCDate() - retentionDays);
    const thresholdStr = thresholdDate.toISOString().split("T")[0];

    console.log(`   Threshold: puzzles older than ${thresholdStr}`);

    const { count, error: cleanupError } = await supabase
      .from("daily_puzzles")
      .delete({ count: "exact" })
      .lt("puzzle_date", thresholdStr);

    if (cleanupError) {
      console.error(` ❌ Cleanup failed: ${cleanupError.message}`);
    } else {
      console.log(` ✅ Cleanup complete. Deleted ${count || 0} old puzzles.`);
    }
  } catch (err) {
    console.error(` ❌ Error during cleanup:`, err);
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Results:`);
  console.log(`   Generated: ${generated}`);
  console.log(`   Errors:    ${errors}`);
  console.log(`   Duration:  ${duration}s`);

  if (errorDetails.length > 0) {
    console.log(`\n⚠️ Error details:`);
    errorDetails.forEach((e) => console.log(`   - ${e}`));
  }

  console.log(
    `\n${errors === 0 ? "✅ All puzzles generated successfully!" : `⚠️ Completed with ${errors} errors`}\n`,
  );

  // Verify against what is actually in the database, not just what this run
  // believes it wrote. A silent insert failure would otherwise pass unnoticed.
  const { count: storedToday } = await supabase
    .from("daily_puzzles")
    .select("*", { count: "exact", head: true })
    .eq("puzzle_date", targetDate);

  console.log(`   In database for ${targetDate}: ${storedToday ?? 0}`);

  const planned = generated + errors;
  const ratio = planned === 0 ? 1 : generated / planned;
  const healthy = ratio >= MIN_SUCCESS_RATIO && (storedToday ?? 0) > 0;

  if (!healthy) {
    console.error(
      `FAILED: only ${generated}/${planned} puzzles generated ` +
        `(${Math.round(ratio * 100)}%, threshold ${MIN_SUCCESS_RATIO * 100}%).
` +
        `   Failing the job so this surfaces in GitHub Actions rather than as
` +
        `   an app that quietly serves yesterday's puzzles.`,
    );
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("💀 Fatal error:", err);
  process.exit(1);
});

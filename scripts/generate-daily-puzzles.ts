/**
 * generate-daily-puzzles.ts — Standalone Node.js script for daily puzzle generation.
 *
 * Runs in GitHub Actions (not Supabase Edge Functions) to avoid timeout limits.
 * Generates all 101 daily puzzles and stores them in Supabase Postgres.
 *
 * Usage:
 *   npx tsx scripts/generate-daily-puzzles.ts [YYYY-MM-DD]
 *
 * Required environment variables:
 *   SUPABASE_URL           — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key for DB writes
 *   GEMINI_API_KEY         — Google Gemini 2.5 Flash API key
 */

import { createClient } from "@supabase/supabase-js";

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

interface DailyPuzzleData {
  words: PuzzleWord[];
  metadata: {
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

async function generatePuzzleWords(
  category: string,
  difficulty: Difficulty,
  gridSize: GridSize,
  apiKey: string,
): Promise<GeneratedClue[]> {
  const settings = GRID_SIZES[gridSize];
  const wordCount = settings.maxWords;
  const maxLength = settings.maxWordLength;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `Generate exactly ${wordCount} unique words appropriate for a ${gridSize}x${gridSize} crossword puzzle grid.
Rules:
1. Category: ${category}
2. Difficulty: ${difficulty} (Adjust word complexity/obscurity accordingly)
3. Words must be between 3 and ${maxLength} letters long.
4. Provide a clear, standard crossword clue for each word.
5. Randomly set exactly 1 'isHint' to true, the rest false.
6. YOU MUST OUTPUT STRICTLY VALID JSON. NO MARKDOWN. NO CONVERSATIONAL TEXT. NO \`\`\`json.
7. DO NOT OUTPUT ANY TEXT OTHER THAN THE JSON ARRAY.

Output Format:
[
  { "word": "ANSWER", "clue": "Question or hint here", "isHint": false }
]`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error (${response.status}): ${errorText.substring(0, 200)}`,
    );
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error("Gemini returned empty response");

  // Robustly extract JSON objects from the response using regex
  // Gemini sometimes returns malformed arrays (missing closing brackets, trailing commas)
  // This approach finds every object that looks like our expected schema
  const extractedWords: GeneratedClue[] = [];
  const objectRegex =
    /\{[^{}]*"word"\s*:\s*"([^"]+)"[^{}]*"clue"\s*:\s*"([^"]+)"[^{}]*"isHint"\s*:\s*(true|false)[^{}]*\}/g;

  let match;
  while ((match = objectRegex.exec(responseText)) !== null) {
    extractedWords.push({
      word: match[1].toUpperCase().replace(/[^A-Z]/g, ""),
      clue: match[2],
      isHint: match[3] === "true",
    });
  }

  if (extractedWords.length === 0) {
    console.warn(
      `[JSON Parse Error] Raw text:\n${responseText.substring(0, 200)}...`,
    );
    throw new Error(
      "Could not extract any valid word objects from Gemini response",
    );
  }

  return extractedWords
    .filter((item) => item.word.length >= 3 && item.word.length <= maxLength)
    .slice(0, wordCount);
}

// ═══════════════════════════════════════════════════════════════════
// MANIFEST — 101 PUZZLES PER DAY
// ═══════════════════════════════════════════════════════════════════

function buildDailyManifest(): PuzzleSpec[] {
  const specs: PuzzleSpec[] = [];
  const categories: Category[] = [
    "general",
    "history",
    "technology",
    "entertainment",
    "sports",
  ];
  const gridSizes: GridSize[] = [6, 8, 10, 12];

  for (const category of categories) {
    // Easy: 2×6×6, 2×8×8, 1×10×10, 1×12×12 = 6 per category
    specs.push({
      category,
      difficulty: "easy",
      gridSize: 6,
      variant: 1,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "easy",
      gridSize: 6,
      variant: 2,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "easy",
      gridSize: 8,
      variant: 1,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "easy",
      gridSize: 8,
      variant: 2,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "easy",
      gridSize: 10,
      variant: 1,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "easy",
      gridSize: 12,
      variant: 1,
      isDailyChallenge: false,
    });

    // Medium: same distribution as Easy = 6 per category
    specs.push({
      category,
      difficulty: "medium",
      gridSize: 6,
      variant: 1,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "medium",
      gridSize: 6,
      variant: 2,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "medium",
      gridSize: 8,
      variant: 1,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "medium",
      gridSize: 8,
      variant: 2,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "medium",
      gridSize: 10,
      variant: 1,
      isDailyChallenge: false,
    });
    specs.push({
      category,
      difficulty: "medium",
      gridSize: 12,
      variant: 1,
      isDailyChallenge: false,
    });

    // Hard: 1 per grid = 4 per category
    for (const gs of gridSizes) {
      specs.push({
        category,
        difficulty: "hard",
        gridSize: gs,
        variant: 1,
        isDailyChallenge: false,
      });
    }
    // Expert: 1 per grid = 4 per category
    for (const gs of gridSizes) {
      specs.push({
        category,
        difficulty: "expert",
        gridSize: gs,
        variant: 1,
        isDailyChallenge: false,
      });
    }
  }

  // Daily Challenge: mixed categories, medium, 10×10
  specs.push({
    category: "daily_challenge",
    difficulty: "medium",
    gridSize: 10,
    variant: 1,
    isDailyChallenge: true,
  });

  return specs; // 101 items
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
  const manifest = buildDailyManifest();
  console.log(`📋 Manifest: ${manifest.length} puzzles\n`);

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

  // Run in parallel chunks of 10 to speed up generation
  const CHUNK_SIZE = 10;
  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    const chunk = missing.slice(i, i + CHUNK_SIZE);
    console.log(
      `\n⏳ Processing batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(missing.length / CHUNK_SIZE)}...`,
    );

    const promises = chunk.map(async (spec) => {
      const label = `${spec.category}/${spec.difficulty}/${spec.gridSize}x${spec.gridSize}/v${spec.variant}`;
      try {
        const geminiCategory = spec.isDailyChallenge
          ? "mixed general knowledge spanning history, science, pop culture, geography, sports, and everyday life"
          : spec.category;

        // Step 1: Generate words via Gemini
        const words = await generatePuzzleWords(
          geminiCategory,
          spec.difficulty,
          spec.gridSize,
          geminiKey,
        );
        if (words.length < 3)
          throw new Error(`Only ${words.length} words returned`);

        // Step 2: Build simple lightweight data structure
        const puzzleData: DailyPuzzleData = {
          words,
          metadata: {
            category: spec.category,
            difficulty: spec.difficulty,
            gridSize: spec.gridSize,
            isDailyChallenge: spec.isDailyChallenge,
            estimatedTime: words.length * 30,
            totalWords: words.length,
          },
        };

        // Step 3: Store ONLY the word definitions in database
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
              total_words: words.length,
              estimated_time: puzzleData.metadata.estimatedTime,
            },
            { onConflict: "puzzle_date,category,difficulty,grid_size,variant" },
          );

        if (insertError)
          throw new Error(`Insert failed: ${insertError.message}`);

        generated++;
        console.log(` ✅ ${label} — ${words.length} words stored`);
      } catch (err) {
        errors++;
        const errMsg = err instanceof Error ? err.message : String(err);
        errorDetails.push(`${label}: ${errMsg}`);
        console.error(` ❌ ${label}: ${errMsg}`);
      }
    });

    await Promise.all(promises);
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

  process.exit(errors > 0 && generated === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("💀 Fatal error:", err);
  process.exit(1);
});

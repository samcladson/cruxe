/**
 * generate-daily-puzzles — Single-file Supabase Edge Function.
 *
 * Generates 101 daily crossword puzzles and stores them in Postgres.
 * Deploy via: Supabase Dashboard → Edge Functions → Create Function
 *
 * Required secrets (set in Dashboard → Edge Functions → Secrets):
 *   - GEMINI_API_KEY: Google Gemini 2.5 Flash API key
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically available.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

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

interface CrosswordClue {
  id: string;
  number: number;
  direction: Direction;
  clue: string;
  answer: string;
  startRow: number;
  startCol: number;
  length: number;
  isPreFilled: boolean;
  preFilledIndices: number[];
}

interface GridCell {
  row: number;
  col: number;
  letter: string | null;
  isBlocked: boolean;
  isPreFilled: boolean;
  userInput: string;
  clueNumbers: number[];
  clueIds: string[];
  state: "empty" | "filled" | "correct" | "incorrect" | "prefilled";
}

interface Puzzle {
  id: string;
  category: Category;
  difficulty: Difficulty;
  gridSize: GridSize;
  grid: GridCell[][];
  clues: CrosswordClue[];
  acrossClues: CrosswordClue[];
  downClues: CrosswordClue[];
  reverseAcrossClues: CrosswordClue[];
  reverseDownClues: CrosswordClue[];
  date: string;
  estimatedTime: number;
  totalWords: number;
  solvedWords: number;
  isComplete: boolean;
  startedAt: number | null;
  completedAt: number | null;
  score: number;
  hintsUsed: number;
}

interface PlacedWord {
  word: string;
  clue: string;
  isHint: boolean;
  row: number;
  col: number;
  direction: Direction;
}

interface PuzzleSpec {
  category: Category;
  difficulty: Difficulty;
  gridSize: GridSize;
  variant: number;
  isDailyChallenge: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// GRID CONFIG
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

const DIR_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  across: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
  reverse_across: { dr: 0, dc: -1 },
  reverse_down: { dr: -1, dc: 0 },
};

// ═══════════════════════════════════════════════════════════════════
// CROSSWORD ENGINE
// ═══════════════════════════════════════════════════════════════════

function buildEmptyGrid(size: number): GridCell[][] {
  const grid: GridCell[][] = [];
  for (let r = 0; r < size; r++) {
    const row: GridCell[] = [];
    for (let c = 0; c < size; c++) {
      row.push({
        row: r,
        col: c,
        letter: null,
        isBlocked: true,
        isPreFilled: false,
        userInput: "",
        clueNumbers: [],
        clueIds: [],
        state: "empty",
      });
    }
    grid.push(row);
  }
  return grid;
}

function getCellPos(
  startRow: number,
  startCol: number,
  dir: Direction,
  i: number,
) {
  const d = DIR_DELTAS[dir];
  return { r: startRow + d.dr * i, c: startCol + d.dc * i };
}

function canPlaceWord(
  grid: GridCell[][],
  word: string,
  startRow: number,
  startCol: number,
  dir: Direction,
): boolean {
  const size = grid.length;
  const d = DIR_DELTAS[dir];

  for (let i = 0; i < word.length; i++) {
    const { r, c } = getCellPos(startRow, startCol, dir, i);
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
  }

  const { r: bR, c: bC } = getCellPos(startRow, startCol, dir, -1);
  if (
    bR >= 0 &&
    bR < size &&
    bC >= 0 &&
    bC < size &&
    grid[bR][bC].letter !== null
  )
    return false;

  const { r: aR, c: aC } = getCellPos(startRow, startCol, dir, word.length);
  if (
    aR >= 0 &&
    aR < size &&
    aC >= 0 &&
    aC < size &&
    grid[aR][aC].letter !== null
  )
    return false;

  for (let i = 0; i < word.length; i++) {
    const { r, c } = getCellPos(startRow, startCol, dir, i);
    const cellLetter = grid[r][c].letter;
    if (cellLetter !== null) {
      if (cellLetter !== word[i]) return false;
    } else {
      if (d.dr === 0) {
        if (r > 0 && grid[r - 1][c].letter !== null) return false;
        if (r < size - 1 && grid[r + 1][c].letter !== null) return false;
      } else {
        if (c > 0 && grid[r][c - 1].letter !== null) return false;
        if (c < size - 1 && grid[r][c + 1].letter !== null) return false;
      }
    }
  }
  return true;
}

function placeWord(
  grid: GridCell[][],
  word: string,
  startRow: number,
  startCol: number,
  dir: Direction,
) {
  for (let i = 0; i < word.length; i++) {
    const { r, c } = getCellPos(startRow, startCol, dir, i);
    grid[r][c].letter = word[i];
    grid[r][c].isBlocked = false;
  }
}

function findCandidatePlacements(
  grid: GridCell[][],
  word: string,
  placed: PlacedWord[],
) {
  const candidates: {
    row: number;
    col: number;
    dir: Direction;
    crossings: number;
  }[] = [];
  const allDirs: Direction[] = [
    "across",
    "down",
    "reverse_across",
    "reverse_down",
  ];
  for (const p of placed) {
    for (let i = 0; i < p.word.length; i++) {
      const pChar = p.word[i];
      const { r: pRow, c: pCol } = getCellPos(p.row, p.col, p.direction, i);
      for (let j = 0; j < word.length; j++) {
        if (word[j] !== pChar) continue;
        for (const newDir of allDirs) {
          const nd = DIR_DELTAS[newDir];
          const nR = pRow - nd.dr * j;
          const nC = pCol - nd.dc * j;
          if (canPlaceWord(grid, word, nR, nC, newDir)) {
            let crossings = 0;
            for (let k = 0; k < word.length; k++) {
              const { r, c } = getCellPos(nR, nC, newDir, k);
              if (grid[r][c].letter === word[k]) crossings++;
            }
            candidates.push({ row: nR, col: nC, dir: newDir, crossings });
          }
        }
      }
    }
  }
  candidates.sort((a, b) => b.crossings - a.crossings);
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const k = `${c.row},${c.col},${c.dir}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildPuzzle(
  rawClues: GeneratedClue[],
  category: Category,
  difficulty: Difficulty,
  gridSize: GridSize,
): Puzzle {
  const words = [...rawClues].sort((a, b) => b.word.length - a.word.length);
  let bestPlaced: PlacedWord[] = [];
  let bestGrid: GridCell[][] = buildEmptyGrid(gridSize);
  const MAX_ATTEMPTS = 6;
  const allFirstDirs: Direction[] = [
    "across",
    "down",
    "reverse_across",
    "reverse_down",
  ];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const grid = buildEmptyGrid(gridSize);
    const placed: PlacedWord[] = [];
    const wordPool = attempt === 0 ? [...words] : shuffleArray([...words]);
    const first = wordPool.shift()!;
    const firstDir = allFirstDirs[attempt % allFirstDirs.length];
    let startR: number, startC: number;

    if (firstDir === "across") {
      startR = Math.floor(gridSize / 2);
      startC = Math.floor((gridSize - first.word.length) / 2);
    } else if (firstDir === "down") {
      startR = Math.floor((gridSize - first.word.length) / 2);
      startC = Math.floor(gridSize / 2);
    } else if (firstDir === "reverse_across") {
      startR = Math.floor(gridSize / 2);
      startC = Math.floor((gridSize + first.word.length) / 2) - 1;
    } else {
      startR = Math.floor((gridSize + first.word.length) / 2) - 1;
      startC = Math.floor(gridSize / 2);
    }

    if (canPlaceWord(grid, first.word, startR, startC, firstDir)) {
      placeWord(grid, first.word, startR, startC, firstDir);
      placed.push({ ...first, row: startR, col: startC, direction: firstDir });
    }

    const unplaced = [...wordPool];
    let staleCount = 0;
    while (unplaced.length > 0 && staleCount < unplaced.length * 3) {
      const current = unplaced.shift()!;
      const candidates = findCandidatePlacements(grid, current.word, placed);
      if (candidates.length > 0) {
        const best = candidates[0];
        placeWord(grid, current.word, best.row, best.col, best.dir);
        placed.push({
          ...current,
          row: best.row,
          col: best.col,
          direction: best.dir,
        });
        staleCount = 0;
      } else {
        unplaced.push(current);
        staleCount++;
      }
    }
    if (placed.length > bestPlaced.length) {
      bestPlaced = placed;
      bestGrid = grid;
    }
    if (placed.length === words.length) break;
  }

  const cluesOutput: CrosswordClue[] = [];
  let currentNumber = 1;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (bestGrid[r][c].isBlocked) continue;
      let needsNumber = false;
      for (const p of bestPlaced) {
        if (p.row === r && p.col === c) {
          needsNumber = true;
          break;
        }
      }
      if (needsNumber) {
        bestGrid[r][c].clueNumbers.push(currentNumber);
        for (const dir of [
          "across",
          "down",
          "reverse_across",
          "reverse_down",
        ] as Direction[]) {
          const wordAttr = bestPlaced.find(
            (p) => p.row === r && p.col === c && p.direction === dir,
          );
          if (!wordAttr) continue;
          const clueId = `${currentNumber}-${dir}`;
          const clueObj: CrosswordClue = {
            id: clueId,
            number: currentNumber,
            direction: dir,
            clue: wordAttr.clue,
            answer: wordAttr.word,
            startRow: r,
            startCol: c,
            length: wordAttr.word.length,
            isPreFilled: wordAttr.isHint,
            preFilledIndices: wordAttr.isHint
              ? [0, Math.floor(wordAttr.word.length / 2)]
              : [],
          };
          cluesOutput.push(clueObj);
          for (let i = 0; i < wordAttr.word.length; i++) {
            const { r: cr, c: cc } = getCellPos(r, c, dir, i);
            bestGrid[cr][cc].clueIds.push(clueId);
            if (wordAttr.isHint && clueObj.preFilledIndices.includes(i)) {
              bestGrid[cr][cc].isPreFilled = true;
              bestGrid[cr][cc].userInput = wordAttr.word[i];
              bestGrid[cr][cc].state = "correct";
            }
          }
        }
        currentNumber++;
      }
    }
  }

  return {
    id: `puzzle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    difficulty,
    gridSize,
    grid: bestGrid,
    clues: cluesOutput,
    acrossClues: cluesOutput.filter((c) => c.direction === "across"),
    downClues: cluesOutput.filter((c) => c.direction === "down"),
    reverseAcrossClues: cluesOutput.filter(
      (c) => c.direction === "reverse_across",
    ),
    reverseDownClues: cluesOutput.filter((c) => c.direction === "reverse_down"),
    date: new Date().toISOString(),
    estimatedTime: bestPlaced.length * 30,
    totalWords: bestPlaced.length,
    solvedWords: 0,
    isComplete: false,
    startedAt: null,
    completedAt: null,
    score: 0,
    hintsUsed: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// GEMINI SERVICE
// ═══════════════════════════════════════════════════════════════════

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function generatePuzzleWords(
  category: string,
  difficulty: Difficulty,
  gridSize: GridSize,
): Promise<GeneratedClue[]> {
  const settings = GRID_SIZES[gridSize];
  const wordCount = settings.maxWords;
  const maxLength = settings.maxWordLength;

  const prompt = `Generate exactly ${wordCount} unique words appropriate for a ${gridSize}x${gridSize} crossword puzzle grid.
Rules:
1. Category: ${category}
2. Difficulty: ${difficulty}. Easy: common vocabulary. Medium: moderate, some wordplay. Hard: advanced, cryptic clues. Expert: obscure, very tricky.
3. Maximum word length: ${maxLength} letters. Minimum: 3 letters.
4. Words MUST vary in length — include short (3-4), medium (4-6), and long words.
5. Choose words with COMMON LETTERS (E, A, R, S, T, N, O, I) to maximise crossword interlocking.
6. Each word needs one concise, clever crossword-style clue (max 60 characters).
7. Exactly 2-3 words must be marked "isHint": true (pre-revealed helper letters).
8. ALL WORDS MUST BE UPPERCASE with only A-Z characters.
Return a JSON array of objects with fields: word (string), clue (string), isHint (boolean). Return ONLY the JSON array.`;

  const response = await fetch(GEMINI_ENDPOINT, {
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
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error("Gemini returned empty response");

  const rawData = JSON.parse(responseText);
  return rawData
    .filter(
      (item: Record<string, unknown>) =>
        item.word && item.clue && typeof item.word === "string",
    )
    .map((item: Record<string, unknown>) => ({
      word: (item.word as string).toUpperCase().replace(/[^A-Z]/g, ""),
      clue: item.clue as string,
      isHint: Boolean(item.isHint),
    }))
    .filter(
      (item: GeneratedClue) =>
        item.word.length >= 3 && item.word.length <= maxLength,
    )
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
    // Easy: 2×6×6, 2×8×8, 1×10×10, 1×12×12 = 6
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

    // Medium: same as Easy = 6
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

    // Hard: 1 per grid = 4
    for (const gridSize of gridSizes) {
      specs.push({
        category,
        difficulty: "hard",
        gridSize,
        variant: 1,
        isDailyChallenge: false,
      });
    }
    // Expert: 1 per grid = 4
    for (const gridSize of gridSizes) {
      specs.push({
        category,
        difficulty: "expert",
        gridSize,
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
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

Deno.serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse target date
    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body.date || new Date().toISOString().split("T")[0];
    } catch {
      targetDate = new Date().toISOString().split("T")[0];
    }

    console.log(`[generate] Starting for ${targetDate}`);

    // Init Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build manifest and check existing
    const manifest = buildDailyManifest();
    const { data: existing, error: fetchError } = await supabase
      .from("daily_puzzles")
      .select("category, difficulty, grid_size, variant")
      .eq("puzzle_date", targetDate);

    if (fetchError) throw new Error(`Query failed: ${fetchError.message}`);

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
      `[generate] ${existing?.length || 0} exist, ${missing.length} to generate`,
    );

    // Generate missing puzzles
    let generated = 0,
      errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < missing.length; i++) {
      const spec = missing[i];
      const label = `${spec.category}/${spec.difficulty}/${spec.gridSize}/v${spec.variant}`;

      try {
        console.log(`[${i + 1}/${missing.length}] ${label}`);

        const geminiCategory = spec.isDailyChallenge
          ? "mixed general knowledge spanning history, science, pop culture, geography, sports, and everyday life"
          : spec.category;

        const words = await generatePuzzleWords(
          geminiCategory,
          spec.difficulty,
          spec.gridSize,
        );
        if (words.length < 3)
          throw new Error(`Only ${words.length} words returned`);

        const puzzle = buildPuzzle(
          words,
          spec.category,
          spec.difficulty,
          spec.gridSize,
        );

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
              puzzle_data: puzzle,
              total_words: puzzle.totalWords,
              estimated_time: puzzle.estimatedTime,
            },
            { onConflict: "puzzle_date,category,difficulty,grid_size,variant" },
          );

        if (insertError)
          throw new Error(`Insert failed: ${insertError.message}`);
        generated++;
        console.log(
          `[${i + 1}/${missing.length}] ✅ ${label} — ${puzzle.totalWords} words`,
        );

        // Rate limit delay between Gemini calls
        if (i < missing.length - 1)
          await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        errors++;
        errorDetails.push(`${label}: ${(err as Error).message}`);
        console.error(
          `[${i + 1}/${missing.length}] ❌ ${label}: ${(err as Error).message}`,
        );
      }
    }

    const report = {
      date: targetDate,
      total: manifest.length,
      alreadyExisted: manifest.length - missing.length,
      generated,
      errors,
      errorDetails,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `[generate] Done. Generated: ${generated}, Errors: ${errors}, Time: ${report.durationMs}ms`,
    );
    return new Response(JSON.stringify(report), {
      status: errors > 0 && generated === 0 ? 500 : 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate] Fatal:", err);
    return new Response(
      JSON.stringify({
        error: (err as Error).message,
        durationMs: Date.now() - startTime,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

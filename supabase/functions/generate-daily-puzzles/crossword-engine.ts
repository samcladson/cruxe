/**
 * crossword-engine.ts — Deno port of the client-side crossword grid builder.
 *
 * This is a self-contained module that takes an array of words+clues and
 * constructs a crossword puzzle grid with 4-directional placement
 * (across, down, reverse_across, reverse_down).
 *
 * Ported from: services/crosswordEngine.ts
 * Changes: Removed all npm imports, uses only standard TypeScript types.
 */

// ─── Types ───────────────────────────────────────────────────────────

export type Category =
  | "general"
  | "history"
  | "technology"
  | "entertainment"
  | "sports"
  | "daily_challenge";
export type Difficulty = "easy" | "medium" | "hard" | "expert";
export type GridSize = 6 | 8 | 10 | 12;
export type Direction = "across" | "down" | "reverse_across" | "reverse_down";

export interface GeneratedClue {
  word: string;
  clue: string;
  isHint: boolean;
}

export interface CrosswordClue {
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

export interface GridCell {
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

export interface Puzzle {
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

// ─── Internal types ──────────────────────────────────────────────────

interface PlacedWord {
  word: string;
  clue: string;
  isHint: boolean;
  row: number;
  col: number;
  direction: Direction;
}

// ─── Grid configuration ─────────────────────────────────────────────

export const GRID_SIZES: Record<
  GridSize,
  { maxWords: number; maxWordLength: number }
> = {
  6: { maxWords: 14, maxWordLength: 6 },
  8: { maxWords: 22, maxWordLength: 8 },
  10: { maxWords: 32, maxWordLength: 10 },
  12: { maxWords: 44, maxWordLength: 12 },
};

// ─── Direction deltas ────────────────────────────────────────────────

const DIR_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  across: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
  reverse_across: { dr: 0, dc: -1 },
  reverse_down: { dr: -1, dc: 0 },
};

// ─── Helper functions ────────────────────────────────────────────────

/** Creates an empty NxN grid where every cell starts as blocked. */
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

/** Returns the (row, col) for the i-th letter of a word placed at (startRow, startCol). */
function getCellPos(
  startRow: number,
  startCol: number,
  dir: Direction,
  i: number,
) {
  const d = DIR_DELTAS[dir];
  return { r: startRow + d.dr * i, c: startCol + d.dc * i };
}

/**
 * Validates whether a word can legally be placed at the given position.
 * Checks bounds, letter collisions, and adjacency rules.
 */
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

  const { r: beforeR, c: beforeC } = getCellPos(startRow, startCol, dir, -1);
  if (beforeR >= 0 && beforeR < size && beforeC >= 0 && beforeC < size) {
    if (grid[beforeR][beforeC].letter !== null) return false;
  }

  const { r: afterR, c: afterC } = getCellPos(
    startRow,
    startCol,
    dir,
    word.length,
  );
  if (afterR >= 0 && afterR < size && afterC >= 0 && afterC < size) {
    if (grid[afterR][afterC].letter !== null) return false;
  }

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

/** Places a word onto the grid by setting each cell's letter and unblocking it. */
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

/**
 * Finds all possible positions where a word can intersect with already-placed words.
 * Returns candidates sorted by crossing count (denser = better).
 */
function findCandidatePlacements(
  grid: GridCell[][],
  word: string,
  placed: PlacedWord[],
): { row: number; col: number; dir: Direction; crossings: number }[] {
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
          const newStartRow = pRow - nd.dr * j;
          const newStartCol = pCol - nd.dc * j;

          if (canPlaceWord(grid, word, newStartRow, newStartCol, newDir)) {
            let crossings = 0;
            for (let k = 0; k < word.length; k++) {
              const { r, c } = getCellPos(newStartRow, newStartCol, newDir, k);
              if (grid[r][c].letter === word[k]) crossings++;
            }
            candidates.push({
              row: newStartRow,
              col: newStartCol,
              dir: newDir,
              crossings,
            });
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.crossings - a.crossings);

  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.row},${c.col},${c.dir}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Fisher-Yates shuffle for exploring different word orderings across attempts. */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ─── Main puzzle builder ─────────────────────────────────────────────

/**
 * Core puzzle builder using a greedy placement strategy with multiple retries.
 * Places words in all 4 directions to maximise grid density and interlocking.
 */
export function buildPuzzle(
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

    // Place the first word at the center
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

    // Place remaining words
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

  // Number the grid cells and build clue output
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

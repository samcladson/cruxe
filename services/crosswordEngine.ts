import {
  Category,
  CrosswordClue,
  Difficulty,
  Direction,
  GridCell,
  GridSize,
  Puzzle,
} from "../types/puzzle.types";

interface PlacedWord {
  word: string;
  clue: string;
  isHint?: boolean;
  row: number;
  col: number;
  direction: Direction;
}

/**
 * Creates an empty NxN grid where every cell starts as blocked.
 * Cells are unblocked only when a word occupies them.
 */
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

/**
 * All 4 direction deltas for traversing a word on the grid.
 *   across:          left-to-right (dr=0, dc=+1)
 *   down:            top-to-bottom (dr=+1, dc=0)
 *   reverse_across:  right-to-left (backwards, dr=0, dc=-1)
 *   reverse_down:    bottom-to-top (up, dr=-1, dc=0)
 */
const DIR_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  across: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
  reverse_across: { dr: 0, dc: -1 },
  reverse_down: { dr: -1, dc: 0 },
};

/**
 * Returns the row,col for the i-th letter of a word placed at (startRow,startCol) in the given direction.
 */
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
 * Validates whether a word can legally be placed at the given position in any of the 4 directions.
 * Checks bounds, letter collisions, and adjacency rules to prevent
 * words from touching in parallel (only crossing is allowed).
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

  // Check that every letter falls within bounds
  for (let i = 0; i < word.length; i++) {
    const { r, c } = getCellPos(startRow, startCol, dir, i);
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
  }

  // Check cell before word start (must be blocked or edge)
  const { r: beforeR, c: beforeC } = getCellPos(startRow, startCol, dir, -1);
  if (beforeR >= 0 && beforeR < size && beforeC >= 0 && beforeC < size) {
    if (grid[beforeR][beforeC].letter !== null) return false;
  }

  // Check cell after word end
  const { r: afterR, c: afterC } = getCellPos(
    startRow,
    startCol,
    dir,
    word.length,
  );
  if (afterR >= 0 && afterR < size && afterC >= 0 && afterC < size) {
    if (grid[afterR][afterC].letter !== null) return false;
  }

  // Check each letter position
  for (let i = 0; i < word.length; i++) {
    const { r, c } = getCellPos(startRow, startCol, dir, i);
    const cellLetter = grid[r][c].letter;

    if (cellLetter !== null) {
      // Cell already has a letter — must match for a valid crossing
      if (cellLetter !== word[i]) return false;
    } else {
      // Empty cell — check that perpendicular neighbors are empty
      // to prevent words from touching in parallel
      if (d.dr === 0) {
        // Horizontal direction — check cells above and below
        if (r > 0 && grid[r - 1][c].letter !== null) return false;
        if (r < size - 1 && grid[r + 1][c].letter !== null) return false;
      } else {
        // Vertical direction — check cells left and right
        if (c > 0 && grid[r][c - 1].letter !== null) return false;
        if (c < size - 1 && grid[r][c + 1].letter !== null) return false;
      }
    }
  }

  return true;
}

/**
 * Places a word onto the grid by setting each cell's letter and unblocking it.
 */
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
 * Finds all possible positions where a word can intersect with already-placed words
 * in any of the 4 directions. Returns candidates sorted by crossing count (denser = better).
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

        // Try all directions that are perpendicular or different from the placed word
        for (const newDir of allDirs) {
          const nd = DIR_DELTAS[newDir];
          const newStartRow = pRow - nd.dr * j;
          const newStartCol = pCol - nd.dc * j;

          if (canPlaceWord(grid, word, newStartRow, newStartCol, newDir)) {
            // Count crossings for density scoring
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

  // Sort by most crossings first for denser grids
  candidates.sort((a, b) => b.crossings - a.crossings);

  // Deduplicate (same row, col, dir)
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.row},${c.col},${c.dir}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Core puzzle builder using a greedy placement strategy with multiple retries.
 * Places words in all 4 directions (across, down, backwards, up) to maximise
 * grid density and interlocking.
 */
export function buildPuzzle(
  words: { word: string; clue: string; isHint?: boolean }[],
  category: Category = "general",
  difficulty: Difficulty = "medium",
  gridSize: GridSize = 10,
  puzzleId?: string,
): Puzzle | null {
  const sortedWords = [...words].sort((a, b) => b.word.length - a.word.length);

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
      // reverse_down
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
  const finalSize = gridSize;

  // For each cell, check if it's the start of a word in any direction
  for (let r = 0; r < finalSize; r++) {
    for (let c = 0; c < finalSize; c++) {
      if (bestGrid[r][c].isBlocked) continue;

      let needsNumber = false;

      // Check all 4 directions for word starts at this cell
      for (const p of bestPlaced) {
        if (p.row === r && p.col === c) {
          needsNumber = true;
          break;
        }
      }

      if (needsNumber) {
        bestGrid[r][c].clueNumbers.push(currentNumber);

        // Process each direction that starts here
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
            isPreFilled: !!wordAttr.isHint,
            preFilledIndices: wordAttr.isHint
              ? [0, Math.floor(wordAttr.word.length / 2)]
              : [],
          };
          cluesOutput.push(clueObj);

          // Tag grid cells and pre-fill hints
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
    id: puzzleId || `puzzle-${Date.now()}`,
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
    startedAt: Date.now(),
    completedAt: null,
    score: 0,
    hintsUsed: 0,
  };
}

/**
 * Fisher-Yates shuffle for exploring different word orderings across attempts.
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

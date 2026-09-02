/**
 * hintEngine.ts — Central hint logic service for the Cruxe crossword game.
 *
 * Defines the three hint types, their coin costs, and provides utility functions
 * for computing dynamic pricing, building word previews, and validating whether
 * a hint is applicable to the current game state.
 */

import {
    CrosswordClue,
    Direction,
    GridCell,
    Puzzle,
} from "../types/puzzle.types";
import { findClueId } from "../utils/clueId";

// ═══════════════════════════════════════════════════════════════════
// HINT TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

/** All supported hint types in the game */
export type HintType = "reveal_letter" | "reveal_word" | "check_errors";

/** Fixed cost per single letter reveal */
export const REVEAL_LETTER_COST = 30;

/** Cost per use of error checking (only charged after free checks are depleted) */
export const CHECK_ERRORS_COST = 20;

/** Number of free error checks before coins are required */
export const FREE_CHECKS_COUNT = 5;

// ═══════════════════════════════════════════════════════════════════
// DIRECTION DELTAS (mirrors crosswordEngine.ts)
// ═══════════════════════════════════════════════════════════════════

/** Direction movement deltas for traversing word cells on the grid */
const DIR_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  across: { dr: 0, dc: 1 },
  down: { dr: 1, dc: 0 },
  reverse_across: { dr: 0, dc: -1 },
  reverse_down: { dr: -1, dc: 0 },
};

// ═══════════════════════════════════════════════════════════════════
// ACTIVE CLUE RESOLUTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Determines the currently active clue based on the selected cell and direction.
 * Falls back to the first clue the cell belongs to if the preferred direction
 * doesn't match any clue.
 *
 * @param puzzle - The active puzzle
 * @param selectedCell - Currently selected grid cell coordinates
 * @param selectedDirection - Current direction preference
 * @returns The matching CrosswordClue, or null if no valid clue found
 */
export function getActiveClue(
  puzzle: Puzzle,
  selectedCell: { row: number; col: number } | null,
  selectedDirection: Direction,
): CrosswordClue | null {
  if (!selectedCell) return null;

  const cell = puzzle.grid[selectedCell.row]?.[selectedCell.col];
  if (!cell || cell.isBlocked) return null;

  // Try to find a clue matching the selected direction first
  const preferredId = findClueId(cell.clueIds, selectedDirection);
  const targetId = preferredId || cell.clueIds[0];

  if (!targetId) return null;

  return puzzle.clues.find((c) => c.id === targetId) || null;
}

// ═══════════════════════════════════════════════════════════════════
// WORD CELL EXTRACTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Returns the grid cells that belong to a given clue, in order.
 * Walks from the clue's start position along its direction for `clue.length` steps.
 *
 * @param grid - The puzzle grid
 * @param clue - The clue whose cells to extract
 * @returns Array of GridCell objects in word order
 */
export function getWordCells(
  grid: GridCell[][],
  clue: CrosswordClue,
): GridCell[] {
  const cells: GridCell[] = [];
  const d = DIR_DELTAS[clue.direction];

  for (let i = 0; i < clue.length; i++) {
    const r = clue.startRow + d.dr * i;
    const c = clue.startCol + d.dc * i;
    if (grid[r]?.[c]) {
      cells.push(grid[r][c]);
    }
  }

  return cells;
}

// ═══════════════════════════════════════════════════════════════════
// WORD PREVIEW BUILDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Builds a visual preview string for the active word in the hint modal.
 * Shows correctly entered letters in their exact positions and underscores
 * for empty or incorrect cells.
 *
 * Examples:
 *   Word "ELEPHANT", user entered "E" at 0 and "P" at 3 correctly:
 *   → ["E", "_", "_", "P", "_", "_", "_", "_"]
 *
 *   Word "SUN", user entered "S" correctly, "X" incorrectly at pos 1:
 *   → ["S", "_", "_"]  (only correct entries shown)
 *
 * @param grid - The puzzle grid
 * @param clue - The active clue to preview
 * @returns Array of characters representing each cell's display state
 */
export function buildWordPreview(
  grid: GridCell[][],
  clue: CrosswordClue,
): string[] {
  const cells = getWordCells(grid, clue);

  return cells.map((cell) => {
    // Show the letter if the user's input matches the correct answer
    if (cell.userInput && cell.userInput === cell.letter) {
      return cell.userInput;
    }
    // Otherwise show an underscore (empty or incorrect)
    return "_";
  });
}

// ═══════════════════════════════════════════════════════════════════
// COST CALCULATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Counts how many letters in the active word still need to be revealed.
 * A cell is "unrevealed" if it's empty, has no input, or has an incorrect input.
 * Pre-filled cells and correctly entered cells are excluded.
 *
 * @param grid - The puzzle grid
 * @param clue - The active clue
 * @returns Number of cells that would be revealed by a "reveal word" hint
 */
export function getUnrevealedLetterCount(
  grid: GridCell[][],
  clue: CrosswordClue,
): number {
  const cells = getWordCells(grid, clue);

  return cells.filter((cell) => {
    // Already correct (either pre-filled or user entered correctly)
    if (cell.userInput === cell.letter) return false;
    return true;
  }).length;
}

// getRevealWordCost has been removed. Revealing a word is now a flat price
// from economy_config, not a multiple of the letter price.

/**
 * Returns the cost for a Check Errors action, accounting for free checks.
 * If free checks remain (checksRemaining > 0), cost is 0.
 * Otherwise, costs CHECK_ERRORS_COST coins.
 *
 * @param checksRemaining - Number of free checks the player still has
 * @returns Coin cost (0 if free checks available)
 */
export function getCheckErrorsCost(checksRemaining: number): number {
  return checksRemaining > 0 ? 0 : CHECK_ERRORS_COST;
}

// ═══════════════════════════════════════════════════════════════════
// HINT AVAILABILITY CHECKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Determines whether "Reveal Letter" is applicable.
 * Returns false if no cell is selected, cell is blocked, or already correct.
 */
export function canRevealLetter(
  puzzle: Puzzle,
  selectedCell: { row: number; col: number } | null,
): boolean {
  if (!selectedCell) return false;

  const cell = puzzle.grid[selectedCell.row]?.[selectedCell.col];
  if (!cell || cell.isBlocked) return false;

  // Already showing the correct letter
  if (cell.userInput === cell.letter) return false;

  return true;
}

/**
 * Determines whether "Reveal Word" is applicable.
 * Returns false if no active clue or entire word is already complete.
 */
export function canRevealWord(
  puzzle: Puzzle,
  clue: CrosswordClue | null,
): boolean {
  if (!clue) return false;
  return getUnrevealedLetterCount(puzzle.grid, clue) > 0;
}

/**
 * Determines affordability — can the user afford a given hint?
 *
 * @param hintCost - The coin cost of the hint
 * @param userCoins - The player's current coin balance
 * @returns true if the player has enough coins
 */
export function canAffordHint(hintCost: number, userCoins: number): boolean {
  return userCoins >= hintCost;
}

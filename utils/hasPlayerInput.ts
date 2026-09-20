import { GridCell } from "../types/puzzle.types";

/**
 * Whether the player has entered at least one letter of their own.
 *
 * Pre-filled cells are excluded deliberately. A puzzle arrives with their
 * `userInput` already set from the answer letter (see puzzleService), so a
 * plain "any cell has input" test is true before the grid has been touched —
 * which let CHECK be spent on a puzzle the player had not started.
 */
export function hasPlayerInput(grid: GridCell[][]): boolean {
  return grid.some((row) =>
    row.some(
      (cell) =>
        !cell.isBlocked && !cell.isPreFilled && cell.userInput.trim() !== "",
    ),
  );
}

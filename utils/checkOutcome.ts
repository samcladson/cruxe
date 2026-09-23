import { GridCell } from "../types/puzzle.types";

/**
 * Whether a check just run on the grid turned up a wrong letter. Read after
 * `checkAnswers` / `checkErrors` have marked each filled cell.
 */
export function checkOutcome(grid: GridCell[][]): "clean" | "errors" {
  const wrong = grid.some((row) =>
    row.some((cell) => !cell.isBlocked && cell.state === "incorrect"),
  );
  return wrong ? "errors" : "clean";
}

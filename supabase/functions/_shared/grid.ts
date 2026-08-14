/**
 * grid.ts — Canonical grid serialisation and verification.
 *
 * Shared by the submit-solve Edge Function and the client. The canonical
 * order is row-major over non-blocked cells; both sides must agree exactly
 * or every submission will mis-verify.
 */

export interface StoredCell {
  letter: string | null;
  isBlocked: boolean;
}

export interface VerificationResult {
  accuracy: number;
  isComplete: boolean;
  correctCells: number;
  totalCells: number;
}

export function canonicalCellOrder<T extends StoredCell>(
  grid: T[][],
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (!grid[row][col].isBlocked) out.push({ row, col });
    }
  }
  return out;
}

export function lettersFromGrid<T extends StoredCell>(grid: T[][]): string {
  return canonicalCellOrder(grid)
    .map(({ row, col }) => (grid[row][col].letter ?? " ").toUpperCase())
    .join("");
}

export function verifySubmission<T extends StoredCell>(
  grid: T[][],
  submitted: string,
): VerificationResult {
  const answer = lettersFromGrid(grid);
  if (submitted.length !== answer.length) {
    throw new Error("length_mismatch");
  }
  const guess = submitted.toUpperCase();

  let correctCells = 0;
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) correctCells++;
  }

  const totalCells = answer.length;
  return {
    correctCells,
    totalCells,
    accuracy: totalCells === 0 ? 0 : correctCells / totalCells,
    isComplete: correctCells === totalCells,
  };
}

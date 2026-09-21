import { CrosswordClue, GridCell } from "../types/puzzle.types";

/**
 * Whether every letter of a clue was entered correctly.
 *
 * Pre-filled and hint-revealed letters count as solved. `revealLetter` marks
 * the cell it reveals as `isPreFilled`, so the grid cannot distinguish a
 * bought letter from one the generator seeded — and charging for words the
 * puzzle itself pre-filled would punish the player for a choice they never
 * made.
 *
 * Case-insensitive on purpose: input is upper-cased on entry, but the answer
 * key comes from the server, and a casing mismatch there would silently lock
 * a word the player got right.
 */
export function isClueSolved(grid: GridCell[][], clueId: string): boolean {
  let seen = 0;

  for (const row of grid) {
    for (const cell of row) {
      if (cell.isBlocked || !cell.clueIds.includes(clueId)) continue;
      seen++;
      const expected = (cell.letter ?? "").toUpperCase();
      if (cell.userInput.toUpperCase() !== expected) return false;
    }
  }

  // A clue with no cells in this grid is not "solved" — it is unknown, and
  // treating unknown as solved would give away a fact for free.
  return seen > 0;
}

/**
 * The answers the player did not get right, as a set for lookup by word.
 *
 * Keyed by answer rather than clue id because that is how the lesson's facts
 * are keyed.
 */
export function unsolvedAnswers(
  grid: GridCell[][],
  clues: readonly CrosswordClue[],
): Set<string> {
  const unsolved = new Set<string>();
  for (const clue of clues) {
    if (!isClueSolved(grid, clue.id)) unsolved.add(clue.answer);
  }
  return unsolved;
}

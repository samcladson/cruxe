/**
 * clueId.ts — Exact matching of clue ids to directions.
 *
 * Clue ids are `${number}-${direction}`, e.g. "1-across", "3-reverse_across".
 *
 * Matching them with `id.includes(direction)` is wrong, and wrong in a way
 * that is easy to miss: "across" is a substring of "reverse_across", and
 * "down" of "reverse_down". So an `across` selection would happily resolve to
 * a `reverse_across` clue, and the cursor would then travel along the wrong
 * axis — which is exactly what made the grid feel unpredictable.
 *
 * Always use these helpers. Never compare clue ids with `includes`.
 */
import { Direction } from "../types/puzzle.types";

/** Reads the direction out of a clue id, or null if it is not one. */
export function directionOf(clueId: string): Direction | null {
  const dash = clueId.indexOf("-");
  if (dash === -1) return null;
  const dir = clueId.slice(dash + 1);
  return dir === "across" ||
    dir === "down" ||
    dir === "reverse_across" ||
    dir === "reverse_down"
    ? (dir as Direction)
    : null;
}

/**
 * Finds the clue id on a cell that runs in exactly `direction`.
 * Returns undefined when the cell has no clue on that axis.
 */
export function findClueId(
  clueIds: string[],
  direction: Direction,
): string | undefined {
  return clueIds.find((id) => directionOf(id) === direction);
}

/**
 * Resolves which clue is active for a cell: the one matching the requested
 * direction, falling back to the cell's first clue when it has none on that
 * axis (which happens when a selection moves onto a cell from a crossing
 * word).
 */
export function resolveClueId(
  clueIds: string[],
  direction: Direction,
): string | undefined {
  return findClueId(clueIds, direction) ?? clueIds[0];
}

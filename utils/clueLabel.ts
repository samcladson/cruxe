import { Direction } from "../types/puzzle.types";

/**
 * Human-readable labels for each direction type.
 *
 * Cruxe places words that read right-to-left and bottom-to-top, so "across"
 * and "down" do not cover it. Shared rather than copied, because two of these
 * strings drifting apart would tell the player their clue ran the wrong way.
 */
export const DIRECTION_LABELS: Record<Direction, string> = {
  across: "ACROSS",
  down: "DOWN",
  reverse_across: "BACKWARDS",
  reverse_down: "UP",
};

/** How a clue is named to the player, e.g. "1 ACROSS" or "2 BACKWARDS". */
export function clueReference(num: number, direction: Direction): string {
  return `${num} ${DIRECTION_LABELS[direction] ?? direction.toUpperCase()}`;
}

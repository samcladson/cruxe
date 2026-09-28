/**
 * gridSize.ts — the crossword grid's size, from the screen width alone.
 *
 * Both the grid (to draw its cells) and the puzzle layout (to share the
 * screen's height with the clue sheet) use this. The layout must calculate
 * the grid's height rather than measure it: measuring fed a loop, because
 * centring the grid moved it on the pixel grid, the height it reported was
 * rounded differently, and the centring changed with it, so the grid shuddered
 * between two positions for as long as the screen was open.
 */

/** Space left beside the grid, 12 on each side. */
export const GRID_SIDE_INSET = 24;
/** The grid's outer border, on each side. */
export const GRID_BORDER = 1.5;
/** Space above and below the grid. */
export const GRID_MARGIN_V = 8;

export function gridCellSize(width: number, gridSize: number): number {
  return gridSize > 0 ? Math.floor((width - GRID_SIDE_INSET) / gridSize) : 0;
}

/** The grid's full height: cells, border and vertical margins. */
export function gridOuterHeight(width: number, gridSize: number): number {
  return (
    gridCellSize(width, gridSize) * gridSize + GRID_BORDER * 2 + GRID_MARGIN_V * 2
  );
}

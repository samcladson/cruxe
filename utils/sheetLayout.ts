/**
 * sheetLayout.ts — how the puzzle screen shares its height between the grid
 * and the clue sheet below it.
 *
 * The area below the clue bar holds the grid, and the sheet (direction tabs,
 * clue list, CHECK / FINISH) is pinned to the bottom of it. Two cases:
 *
 * - Room for clues: the grid sits at the top and the sheet fills everything
 *   below it, listing clues for the current direction.
 * - No room: the sheet is just its controls, the tabs directly on top of the
 *   action bar, flush with the bottom edge. The spare height is split evenly
 *   above and below the grid, so it sits centred instead of leaving a band of
 *   empty space inside the sheet (which lifted the tabs off the action bar).
 *
 * The sheet never moves for the keyboard: the keyboard covers it, and a slim
 * Done bar sits on the keyboard instead (components/grid/KeyboardDoneBar.tsx).
 */

/** Below this, a list area could not show a single clue, so none is shown. */
export const MIN_LIST_HEIGHT = 56;

/** Used until the panel has reported how tall its controls are. */
const FALLBACK_CHROME_HEIGHT = 96;

export interface SheetLayout {
  /** The sheet's height when not raised. */
  restingHeight: number;
  /** Whether the resting sheet lists clues. */
  showList: boolean;
  /** Space above the grid, centring it when the sheet has no list. */
  gridOffset: number;
}

export function sheetLayout(input: {
  /** Height from below the clue bar to the bottom of the screen's body. */
  areaHeight: number;
  /** The grid's height, margins included. */
  gridHeight: number;
  /** The sheet's controls: direction tabs plus the action bar. */
  chromeHeight: number;
}): SheetLayout {
  const chrome = input.chromeHeight || FALLBACK_CHROME_HEIGHT;
  const below = Math.floor(input.areaHeight - input.gridHeight);
  const spare = below - chrome;

  if (spare >= MIN_LIST_HEIGHT) {
    return { restingHeight: below, showList: true, gridOffset: 0 };
  }
  return {
    restingHeight: chrome,
    showList: false,
    gridOffset: Math.max(0, Math.floor(spare / 2)),
  };
}

/**
 * sheetLayout.ts — where the clue sheet rests on the puzzle screen.
 *
 * The sheet fills whatever space the grid leaves below it, so a tall phone
 * shows clues there instead of an empty band. While the keyboard is up it
 * shrinks to its controls (direction tabs and CHECK / FINISH) and sits on top
 * of the keyboard, the same on iOS and Android.
 */

/** Below this, a list area could not show a single clue, so none is shown. */
export const MIN_LIST_HEIGHT = 56;

/** Used until the panel has reported how tall its controls are. */
const FALLBACK_CHROME_HEIGHT = 96;

export interface SheetLayout {
  /** The sheet's height when not raised. */
  restingHeight: number;
  /** Whether the resting sheet has room to list clues. */
  showList: boolean;
  /** Distance from the screen's bottom edge: the keyboard's overlap. */
  bottom: number;
}

export function sheetLayout(input: {
  spaceBelowGrid: number;
  chromeHeight: number;
  keyboardOverlap: number;
}): SheetLayout {
  const chrome = input.chromeHeight || FALLBACK_CHROME_HEIGHT;

  if (input.keyboardOverlap > 0) {
    return { restingHeight: chrome, showList: false, bottom: input.keyboardOverlap };
  }

  const restingHeight = Math.max(chrome, Math.floor(input.spaceBelowGrid));
  return {
    restingHeight,
    showList: restingHeight - chrome >= MIN_LIST_HEIGHT,
    bottom: 0,
  };
}

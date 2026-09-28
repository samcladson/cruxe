/**
 * sheetLayout.ts — where the clue sheet rests on the puzzle screen.
 *
 * The sheet fills whatever space the grid leaves below it, so a tall phone
 * shows clues there instead of an empty band. It never moves for the
 * keyboard: while typing, the keyboard simply covers it and a slim Done bar
 * sits on top of the keyboard instead (components/game/KeyboardDoneBar.tsx).
 * A sheet that rode on the keyboard cluttered the screen and shifted out of
 * line when the keyboard closed.
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
}

export function sheetLayout(input: {
  spaceBelowGrid: number;
  chromeHeight: number;
}): SheetLayout {
  const chrome = input.chromeHeight || FALLBACK_CHROME_HEIGHT;
  const restingHeight = Math.max(chrome, Math.floor(input.spaceBelowGrid));
  return {
    restingHeight,
    showList: restingHeight - chrome >= MIN_LIST_HEIGHT,
  };
}

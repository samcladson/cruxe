/** Gap left between the active row and the top of the keyboard. */
export const ACTIVE_ROW_MARGIN = 12;

/**
 * How far the grid should slide up to keep the active row above the keyboard.
 *
 * The grid keeps its size; only its position changes. Rows above the active
 * one may move out of view, which is the trade being made: the row you are
 * typing into is the one that has to be visible.
 *
 * Needed because Android 15 with edge-to-edge no longer resizes the window
 * for the keyboard — `adjustResize` is deprecated there, so the app draws
 * behind the IME and the lower rows are simply covered.
 *
 * @param activeRowBottomY the active row's bottom edge in screen coordinates
 * @param keyboardTopY     the keyboard's top edge, or Infinity when hidden
 */
export function activeRowShift(
  activeRowBottomY: number,
  keyboardTopY: number,
  margin: number = ACTIVE_ROW_MARGIN,
): number {
  if (!Number.isFinite(keyboardTopY)) return 0;
  if (activeRowBottomY <= 0) return 0;
  return Math.max(0, activeRowBottomY + margin - keyboardTopY);
}

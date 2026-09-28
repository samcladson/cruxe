/**
 * keyboardOverlap.ts — how far the keyboard reaches up over the app's content.
 *
 * Measured from the bottom of the screen: the screen's height less the
 * keyboard's top edge, less the bottom safe-area inset the content already
 * stops short of. Positions measured with measureInWindow must never be
 * compared with the keyboard's screen position directly: on Android
 * edge-to-edge the two differ by the status bar's height, which put the Done
 * bar behind the keyboard and left the grid's typed row partly covered.
 * Compare against distances from the bottom of the content instead.
 */
export function keyboardOverlap(input: {
  /** Screen height, in the same units as the keyboard event (dp / pt). */
  screenHeight: number;
  /** The keyboard's top edge in screen coordinates; Infinity when hidden. */
  keyboardScreenY: number;
  /** The bottom safe-area inset the content ends above. */
  bottomInset: number;
}): number {
  if (!Number.isFinite(input.keyboardScreenY)) return 0;
  const fromScreenBottom = input.screenHeight - input.keyboardScreenY;
  return Math.max(0, fromScreenBottom - input.bottomInset);
}

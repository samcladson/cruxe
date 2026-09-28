/**
 * keyboardLift.ts — how far a form pinned to the bottom of the screen must
 * rise so the keyboard does not cover it.
 *
 * `formBottom` is the form's lower edge in window coordinates and
 * `keyboardTop` the keyboard's upper edge from `useKeyboardTop` (Infinity when
 * hidden). Android 15 with edge-to-edge no longer resizes the window for the
 * keyboard, so the gap has to be measured rather than left to the OS.
 */
export function keyboardLift(
  formBottom: number,
  keyboardTop: number,
  gap = 16,
): number {
  if (!Number.isFinite(keyboardTop) || formBottom <= 0) return 0;
  return Math.max(0, Math.ceil(formBottom - keyboardTop + gap));
}

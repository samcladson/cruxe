/**
 * splashRipple.ts — the crossword grid the launch ripple lights up.
 *
 * It is the logo's own grid (cells of `cell`, `step` apart, centred on the
 * logo) extended to cover the screen, minus the five cells the logo occupies,
 * and grouped into rings by distance from the logo. Each ring is animated as
 * one layer, so the ripple costs a dozen animated views rather than hundreds.
 */

export interface RippleCell {
  key: string;
  left: number;
  top: number;
}

/** The logo: its centre and the four arms. */
const LOGO_CELLS = new Set(["0,0", "0,-1", "1,0", "0,1", "-1,0"]);

export function rippleRings(
  width: number,
  height: number,
  cell: number,
  step: number,
): RippleCell[][] {
  const cols = Math.ceil(width / 2 / step) + 1;
  const rows = Math.ceil(height / 2 / step) + 1;
  const rings: RippleCell[][] = [];
  for (let r = -rows; r <= rows; r++) {
    for (let c = -cols; c <= cols; c++) {
      if (LOGO_CELLS.has(`${c},${r}`)) continue;
      const ring = Math.max(1, Math.round(Math.hypot(c, r)));
      (rings[ring - 1] ??= []).push({
        key: `${c},${r}`,
        left: width / 2 + c * step - cell / 2,
        top: height / 2 + r * step - cell / 2,
      });
    }
  }
  return rings.filter(Boolean);
}

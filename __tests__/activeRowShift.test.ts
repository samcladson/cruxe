import { activeRowShift } from "../utils/activeRowShift";

/**
 * How far the grid slides up so the row being typed into stays above the
 * keyboard.
 *
 * The grid is not resized. On Android 15 with edge-to-edge the window does
 * not shrink for the keyboard at all, so without this the lower rows are
 * simply drawn underneath it.
 *
 * Coordinates are screen-space, and `Infinity` is "no keyboard".
 */
describe("activeRowShift", () => {
  it("does not move when there is no keyboard", () => {
    expect(activeRowShift(900, Infinity)).toBe(0);
  });

  it("does not move when the active row is already clear of the keyboard", () => {
    // Row ends at 400, keyboard starts at 600.
    expect(activeRowShift(400, 600)).toBe(0);
  });

  it("moves just enough to clear the keyboard, plus a margin", () => {
    // Row ends 100px into the keyboard; margin 12 -> shift 112.
    expect(activeRowShift(700, 600, 12)).toBe(112);
  });

  it("still applies the margin when the row ends exactly at the keyboard", () => {
    // Flush against the keyboard reads as cramped, so the margin still shows.
    expect(activeRowShift(600, 600, 12)).toBe(12);
  });

  it("never returns a negative shift", () => {
    // A row far above the keyboard must not push the grid downward.
    expect(activeRowShift(100, 900, 12)).toBe(0);
  });

  it("returns zero before the grid has been measured", () => {
    expect(activeRowShift(0, 600)).toBe(0);
  });

  it("lifts a cell-sized margin so a row of context stays visible below", () => {
    // What the grid actually passes: one cell plus the base margin. A row
    // sitting flush against the keyboard is technically visible and still
    // hard to read, which is what the bare 12px margin produced for every
    // row in the lower half of the grid.
    const cell = 34;
    expect(activeRowShift(600, 600, cell + 12)).toBe(46);
  });

  it("scales the lift with the grid, not with a fixed pixel count", () => {
    // A 12x12 has smaller cells than a 6x6, so the same lift would crowd one
    // and waste space on the other.
    const bigCell = 56;
    const smallCell = 28;
    expect(activeRowShift(600, 600, bigCell + 12)).toBeGreaterThan(
      activeRowShift(600, 600, smallCell + 12),
    );
  });
});

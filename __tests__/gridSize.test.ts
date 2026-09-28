import { gridCellSize, gridOuterHeight } from "../utils/gridSize";

/**
 * The grid's size, calculated rather than measured. Measuring it fed a loop:
 * centring the grid moved it on the pixel grid, the rounded height it
 * reported changed by a pixel, the centring changed with it, and the grid
 * shuddered between two positions for as long as the screen was open.
 */
describe("gridSize", () => {
  it("fits whole cells into the width, less the side insets", () => {
    // 347.43dp wide phone, 10 x 10 grid: floor(323.43 / 10) = 32.
    expect(gridCellSize(347.43, 10)).toBe(32);
    expect(gridCellSize(390, 6)).toBe(61);
  });

  it("adds the border and vertical margins to the grid's height", () => {
    // 32 * 10 cells + 1.5 * 2 border + 8 * 2 margin.
    expect(gridOuterHeight(347.43, 10)).toBe(339);
  });

  it("is zero-sized before a puzzle has loaded", () => {
    expect(gridCellSize(390, 0)).toBe(0);
    expect(gridOuterHeight(390, 0)).toBe(19);
  });
});

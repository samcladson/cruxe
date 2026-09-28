import { MIN_LIST_HEIGHT, sheetLayout } from "../utils/sheetLayout";

/**
 * How the puzzle screen shares its height between the grid and the clue
 * sheet. Two bugs shaped these: an empty band between the grid and a sheet
 * that rested at its controls' height, and, after that, an empty band inside
 * the sheet that lifted the direction tabs off the action bar.
 */
describe("sheetLayout", () => {
  const chrome = 100;
  const grid = 400;

  it("fills the space below the grid with clues when there is room", () => {
    expect(
      sheetLayout({ areaHeight: 760, gridHeight: grid, chromeHeight: chrome }),
    ).toEqual({ restingHeight: 360, showList: true, gridOffset: 0 });
  });

  it("keeps the controls together and centres the grid when there is not", () => {
    // 540 - 400 = 140 below the grid; 40 spare, split 20 above and 20 below.
    expect(
      sheetLayout({ areaHeight: 540, gridHeight: grid, chromeHeight: chrome }),
    ).toEqual({ restingHeight: 100, showList: false, gridOffset: 20 });
  });

  it("switches to listing clues exactly when a clue row fits", () => {
    const fits = grid + chrome + MIN_LIST_HEIGHT;
    expect(
      sheetLayout({ areaHeight: fits, gridHeight: grid, chromeHeight: chrome })
        .showList,
    ).toBe(true);
    expect(
      sheetLayout({ areaHeight: fits - 1, gridHeight: grid, chromeHeight: chrome })
        .showList,
    ).toBe(false);
  });

  it("never offsets the grid on a screen too short for it", () => {
    expect(
      sheetLayout({ areaHeight: 450, gridHeight: grid, chromeHeight: chrome })
        .gridOffset,
    ).toBe(0);
  });

  it("uses a fallback height before the controls are measured", () => {
    expect(
      sheetLayout({ areaHeight: 0, gridHeight: 0, chromeHeight: 0 }).restingHeight,
    ).toBeGreaterThan(0);
  });
});

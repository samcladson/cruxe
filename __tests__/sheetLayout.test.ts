import { MIN_LIST_HEIGHT, sheetLayout } from "../utils/sheetLayout";

/**
 * Where the clue sheet rests. It used to rest at the height of its controls
 * alone, leaving an empty band between the grid and the sheet on tall phones.
 */
describe("sheetLayout", () => {
  const chrome = 100;

  it("fills the space below the grid, and lists clues when there is room", () => {
    expect(sheetLayout({ spaceBelowGrid: 260, chromeHeight: chrome, keyboardOverlap: 0 })).toEqual({
      restingHeight: 260,
      showList: true,
      bottom: 0,
    });
  });

  it("stays at its controls' height on a short phone", () => {
    expect(sheetLayout({ spaceBelowGrid: 70, chromeHeight: chrome, keyboardOverlap: 0 })).toEqual({
      restingHeight: 100,
      showList: false,
      bottom: 0,
    });
  });

  it("does not show a list too short to hold a clue", () => {
    const layout = sheetLayout({
      spaceBelowGrid: chrome + MIN_LIST_HEIGHT - 1,
      chromeHeight: chrome,
      keyboardOverlap: 0,
    });
    expect(layout.showList).toBe(false);
    expect(layout.restingHeight).toBe(chrome + MIN_LIST_HEIGHT - 1);
  });

  it("rides on the keyboard as controls only while typing", () => {
    expect(sheetLayout({ spaceBelowGrid: 260, chromeHeight: chrome, keyboardOverlap: 300 })).toEqual({
      restingHeight: 100,
      showList: false,
      bottom: 300,
    });
  });

  it("uses a fallback height before the controls are measured", () => {
    expect(sheetLayout({ spaceBelowGrid: 0, chromeHeight: 0, keyboardOverlap: 0 }).restingHeight).toBeGreaterThan(0);
  });
});

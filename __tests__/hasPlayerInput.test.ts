import { hasPlayerInput } from "../utils/hasPlayerInput";
import { GridCell } from "../types/puzzle.types";

/**
 * Whether the player has actually typed anything.
 *
 * The trap is that a puzzle arrives with its pre-filled cells already
 * carrying `userInput` — puzzleService sets it from the answer letter — so
 * "some cell has input" is true before anyone has touched the grid. CHECK
 * was therefore enabled, and spending a check on an untouched puzzle only
 * confirms the letters it was given.
 */

let nextCol = 0;
function cell(over: Partial<GridCell> = {}): GridCell {
  return {
    row: 0,
    col: nextCol++,
    letter: "A",
    isBlocked: false,
    isPreFilled: false,
    userInput: "",
    clueNumbers: [],
    clueIds: [],
    state: "empty",
    ...over,
  };
}

describe("hasPlayerInput", () => {
  beforeEach(() => {
    nextCol = 0;
  });

  it("is false on an untouched puzzle whose pre-filled cells carry letters", () => {
    // The case that matters: nothing typed, yet two cells have userInput.
    const grid = [
      [
        cell({ isPreFilled: true, userInput: "C", state: "prefilled" }),
        cell(),
        cell({ isPreFilled: true, userInput: "T", state: "prefilled" }),
      ],
    ];
    expect(hasPlayerInput(grid)).toBe(false);
  });

  it("is true once the player types a single letter", () => {
    const grid = [
      [
        cell({ isPreFilled: true, userInput: "C", state: "prefilled" }),
        cell({ userInput: "A" }),
      ],
    ];
    expect(hasPlayerInput(grid)).toBe(true);
  });

  it("ignores blocked cells", () => {
    const grid = [[cell({ isBlocked: true, userInput: "X" }), cell()]];
    expect(hasPlayerInput(grid)).toBe(false);
  });

  it("does not count whitespace as an entry", () => {
    const grid = [[cell({ userInput: " " })]];
    expect(hasPlayerInput(grid)).toBe(false);
  });

  it("is false for an empty grid", () => {
    expect(hasPlayerInput([])).toBe(false);
  });

  it("finds an entry anywhere in the grid, not just the first row", () => {
    const grid = [
      [cell(), cell()],
      [cell(), cell({ userInput: "Z" })],
    ];
    expect(hasPlayerInput(grid)).toBe(true);
  });
});

import { checkOutcome } from "../utils/checkOutcome";
import { GridCell } from "../types/puzzle.types";

/**
 * What a check sounds like. It used to make no sound at all, and the paid
 * check always played the error tone — even when it found nothing wrong,
 * which tells a player who got everything right that they did not.
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

describe("checkOutcome", () => {
  it("is clean when every checked letter is right", () => {
    expect(
      checkOutcome([[cell({ state: "correct" }), cell({ state: "empty" })]]),
    ).toBe("clean");
  });

  it("has errors when any letter is wrong", () => {
    expect(
      checkOutcome([
        [cell({ state: "correct" })],
        [cell({ state: "incorrect" })],
      ]),
    ).toBe("errors");
  });

  it("ignores blocked cells", () => {
    expect(
      checkOutcome([[cell({ isBlocked: true, state: "incorrect" })]]),
    ).toBe("clean");
  });
});

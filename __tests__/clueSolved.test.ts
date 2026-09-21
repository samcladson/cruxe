import { isClueSolved, unsolvedAnswers } from "../utils/clueSolved";
import { CrosswordClue, GridCell } from "../types/puzzle.types";

/**
 * Which words the player actually got right.
 *
 * The takeaway screen gives away the facts for these and charges for the
 * rest. The grid must be completely filled before FINISH is offered, so an
 * unsolved word here is a genuine mistake rather than a blank.
 *
 * Pre-filled and hint-revealed letters are deliberately not considered: a
 * revealed cell is marked `isPreFilled` by `revealLetter`, so the grid cannot
 * tell a bought letter from a gifted one, and charging for words the puzzle
 * itself seeded would punish the player for the generator's choices.
 */

function cell(over: Partial<GridCell> = {}): GridCell {
  return {
    row: 0,
    col: 0,
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

/** One row spelling `answer`, with `typed` as what the player entered. */
function rowFor(clueId: string, answer: string, typed: string): GridCell[][] {
  return [
    answer.split("").map((letter, i) =>
      cell({
        col: i,
        letter,
        userInput: typed[i] ?? "",
        clueIds: [clueId],
      }),
    ),
  ];
}

const clue = (id: string, answer: string): CrosswordClue => ({
  id,
  number: 1,
  direction: "across",
  clue: "…",
  answer,
  startRow: 0,
  startCol: 0,
  length: answer.length,
  isPreFilled: false,
  preFilledIndices: [],
});

describe("isClueSolved", () => {
  it("is true when every letter matches", () => {
    expect(isClueSolved(rowFor("1-across", "FORUM", "FORUM"), "1-across")).toBe(
      true,
    );
  });

  it("is false when one letter is wrong", () => {
    expect(isClueSolved(rowFor("1-across", "FORUM", "FORAM"), "1-across")).toBe(
      false,
    );
  });

  it("is false when a letter was never entered", () => {
    expect(isClueSolved(rowFor("1-across", "FORUM", "FOR M"), "1-across")).toBe(
      false,
    );
  });

  it("ignores case when comparing", () => {
    // setCellValue upper-cases input, but the answer key is the server's and
    // a mismatch in case would silently lock a word the player got right.
    expect(isClueSolved(rowFor("1-across", "FORUM", "forum"), "1-across")).toBe(
      true,
    );
  });

  it("is false for a clue with no cells in the grid", () => {
    expect(isClueSolved(rowFor("1-across", "FORUM", "FORUM"), "9-down")).toBe(
      false,
    );
  });

  it("counts a pre-filled letter as solved when the word is right", () => {
    // The generator seeds pre-filled letters; a word containing one is not
    // the player's fault and must not be charged for.
    const grid = rowFor("1-across", "FORUM", "FORUM");
    grid[0][0] = { ...grid[0][0], isPreFilled: true };
    expect(isClueSolved(grid, "1-across")).toBe(true);
  });
});

describe("unsolvedAnswers", () => {
  it("returns only the answers the player got wrong", () => {
    const grid = [
      ...rowFor("1-across", "FORUM", "FORUM")[0].map((c) => c),
    ];
    const twoRows: GridCell[][] = [
      rowFor("1-across", "FORUM", "FORUM")[0],
      rowFor("3-across", "SENATE", "SENATO")[0],
    ];
    expect(grid.length).toBeGreaterThan(0);

    const result = unsolvedAnswers(twoRows, [
      clue("1-across", "FORUM"),
      clue("3-across", "SENATE"),
    ]);
    expect(result).toEqual(new Set(["SENATE"]));
  });

  it("is empty when everything was correct", () => {
    const twoRows: GridCell[][] = [
      rowFor("1-across", "FORUM", "FORUM")[0],
      rowFor("3-across", "SENATE", "SENATE")[0],
    ];
    expect(
      unsolvedAnswers(twoRows, [
        clue("1-across", "FORUM"),
        clue("3-across", "SENATE"),
      ]).size,
    ).toBe(0);
  });
});

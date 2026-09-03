import {
  canonicalCellOrder,
  lettersFromGrid,
  verifySubmission,
} from "../supabase/functions/_shared/grid";
import type { StoredCell } from "../supabase/functions/_shared/grid";

/** 2x2: (0,0)=C (0,1)=A (1,0)=blocked (1,1)=T */
const grid: StoredCell[][] = [
  [
    { letter: "C", isBlocked: false },
    { letter: "A", isBlocked: false },
  ],
  [
    { letter: null, isBlocked: true },
    { letter: "T", isBlocked: false },
  ],
];

describe("grid verification", () => {
  it("orders fillable cells row-major, skipping blocked ones", () => {
    expect(canonicalCellOrder(grid)).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ]);
  });

  it("serialises the answer key in canonical order", () => {
    expect(lettersFromGrid(grid)).toBe("CAT");
  });

  it("accepts a perfect submission", () => {
    const r = verifySubmission(grid, "CAT");
    expect(r.isComplete).toBe(true);
    expect(r.accuracy).toBe(1);
  });

  it("scores a filled but imperfect submission by correct cells", () => {
    // isComplete means "the player filled the grid in", not "got it right".
    // It gated the reward on a perfect solve, while the client's FINISH
    // button submits any filled grid — so a single wrong letter was refused
    // with 422 and the solve was never recorded at all.
    const r = verifySubmission(grid, "CXT");
    expect(r.isComplete).toBe(true);
    expect(r.correctCells).toBe(2);
    expect(r.accuracy).toBeCloseTo(2 / 3);
  });

  it("is case-insensitive", () => {
    const r = verifySubmission(grid, "cat");
    expect(r.correctCells).toBe(3);
    expect(r.isComplete).toBe(true);
    expect(r.accuracy).toBe(1);
  });

  it("treats a blank cell as unfinished, not merely wrong", () => {
    // A blank is the one thing that still means "not done": the client sends
    // a space for any cell the player left empty.
    const r = verifySubmission(grid, "ca ");
    expect(r.correctCells).toBe(2);
    expect(r.isComplete).toBe(false);
  });

  it("accepts a fully wrong but fully filled grid, scoring it zero", () => {
    const r = verifySubmission(grid, "XYZ");
    expect(r.isComplete).toBe(true);
    expect(r.correctCells).toBe(0);
    expect(r.accuracy).toBe(0);
  });

  it("rejects a submission of the wrong length", () => {
    expect(() => verifySubmission(grid, "CATS")).toThrow("length_mismatch");
  });
});

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

  it("scores a partial submission by correct cells", () => {
    const r = verifySubmission(grid, "CXT");
    expect(r.isComplete).toBe(false);
    expect(r.correctCells).toBe(2);
    expect(r.accuracy).toBeCloseTo(2 / 3);
  });

  it("is case-insensitive and treats blanks as wrong", () => {
    const r = verifySubmission(grid, "ca ");
    expect(r.correctCells).toBe(2);
    expect(r.isComplete).toBe(false);
  });

  it("rejects a submission of the wrong length", () => {
    expect(() => verifySubmission(grid, "CATS")).toThrow("length_mismatch");
  });
});

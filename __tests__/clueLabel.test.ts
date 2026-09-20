import { clueReference } from "../utils/clueLabel";

/**
 * The lesson screen labels each fact with the clue the player just solved.
 *
 * Cruxe runs words backwards and upwards as well as the usual two directions,
 * and those two are the ones an "across"/"down" assumption silently gets
 * wrong — the same substring trap that `clueId` documents.
 */
describe("clueReference", () => {
  it("labels an across clue", () => {
    expect(clueReference(1, "across")).toBe("1 ACROSS");
  });

  it("labels a down clue", () => {
    expect(clueReference(3, "down")).toBe("3 DOWN");
  });

  it("calls a reversed across clue BACKWARDS, not ACROSS", () => {
    expect(clueReference(2, "reverse_across")).toBe("2 BACKWARDS");
  });

  it("calls a reversed down clue UP, not DOWN", () => {
    expect(clueReference(4, "reverse_down")).toBe("4 UP");
  });
});

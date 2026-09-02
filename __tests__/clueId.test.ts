import { directionOf, findClueId, resolveClueId } from "../utils/clueId";

describe("clue id direction matching", () => {
  it("reads the direction out of an id", () => {
    expect(directionOf("1-across")).toBe("across");
    expect(directionOf("12-down")).toBe("down");
    expect(directionOf("3-reverse_across")).toBe("reverse_across");
    expect(directionOf("4-reverse_down")).toBe("reverse_down");
  });

  it("returns null for anything that is not a clue id", () => {
    expect(directionOf("tutorial")).toBeNull();
    expect(directionOf("7-sideways")).toBeNull();
    expect(directionOf("")).toBeNull();
  });

  // The bug this module exists to prevent. "across" is a substring of
  // "reverse_across", so `id.includes(direction)` matched the wrong clue and
  // the cursor then travelled along the wrong axis.
  it("does NOT match a reverse clue when asked for the forward one", () => {
    const ids = ["3-reverse_across"];
    expect(findClueId(ids, "across")).toBeUndefined();
    expect(findClueId(ids, "reverse_across")).toBe("3-reverse_across");
  });

  it("does NOT match reverse_down when asked for down", () => {
    const ids = ["5-reverse_down"];
    expect(findClueId(ids, "down")).toBeUndefined();
    expect(findClueId(ids, "reverse_down")).toBe("5-reverse_down");
  });

  it("picks the right clue at a crossing that has both forms", () => {
    // A square belonging to both a forward and a reverse word on the same
    // axis. Substring matching returned whichever came first in the array.
    const ids = ["3-reverse_across", "1-across"];
    expect(findClueId(ids, "across")).toBe("1-across");
    expect(findClueId(ids, "reverse_across")).toBe("3-reverse_across");
  });

  it("picks the right clue at an ordinary crossing", () => {
    const ids = ["1-across", "2-down"];
    expect(findClueId(ids, "across")).toBe("1-across");
    expect(findClueId(ids, "down")).toBe("2-down");
  });

  describe("resolveClueId", () => {
    it("prefers the requested direction", () => {
      expect(resolveClueId(["1-across", "2-down"], "down")).toBe("2-down");
    });

    it("falls back to the first clue when the axis is absent", () => {
      // Happens when a selection lands on a square from a crossing word.
      expect(resolveClueId(["2-down"], "across")).toBe("2-down");
    });

    it("returns undefined for a square with no clues", () => {
      expect(resolveClueId([], "across")).toBeUndefined();
    });
  });
});

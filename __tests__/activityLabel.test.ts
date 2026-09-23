import { activityLabel } from "../utils/activityLabel";

/**
 * Recent Activity once named every row by category and difficulty, so a
 * week of history read "History • Easy" five times over. These cases pin
 * that the puzzle's own subject is what a row is called.
 */
describe("activityLabel", () => {
  it("names a titled puzzle by its subject, with category and level beneath", () => {
    expect(
      activityLabel({
        title: "The Apollo Programme",
        category: "history",
        difficulty: "medium",
      }),
    ).toEqual({ heading: "The Apollo Programme", detail: "History • Medium" });
  });

  it("falls back to category and level for puzzles made before titles", () => {
    expect(
      activityLabel({ title: null, category: "sports", difficulty: "hard" }),
    ).toEqual({ heading: "Sports • Hard", detail: null });
  });

  it("treats a blank title as no title", () => {
    expect(
      activityLabel({ title: "   ", category: "general", difficulty: "easy" }),
    ).toEqual({ heading: "General • Easy", detail: null });
  });

  it("does not throw on a category the app no longer knows", () => {
    expect(
      activityLabel({
        title: null,
        category: "retired" as any,
        difficulty: "expert",
      }),
    ).toEqual({ heading: "General • Expert", detail: null });
  });
});

import {
  FEEDBACK_MAX_LENGTH,
  isFeedbackCategory,
  validateFeedback,
} from "../utils/feedbackInput";

/**
 * What the feedback form will and will not send.
 *
 * The same bounds are enforced by a CHECK constraint on the table, so a bad
 * submission fails either way. Checking here means the player is told what is
 * wrong before a round trip, rather than getting a Postgres error.
 */
describe("validateFeedback", () => {
  it("accepts a normal message", () => {
    expect(validateFeedback("bug", "The timer keeps running after I win.")).toEqual({
      ok: true,
      message: "The timer keeps running after I win.",
    });
  });

  it("trims surrounding whitespace off the message", () => {
    const result = validateFeedback("idea", "   dark mode please   ");
    expect(result).toEqual({ ok: true, message: "dark mode please" });
  });

  it("rejects an empty message", () => {
    const result = validateFeedback("bug", "");
    expect(result.ok).toBe(false);
  });

  it("rejects a message that is only whitespace", () => {
    // Would otherwise become an empty row that reads as a bug report.
    const result = validateFeedback("bug", "   \n  ");
    expect(result.ok).toBe(false);
  });

  it("rejects a message longer than the column allows", () => {
    const result = validateFeedback("other", "x".repeat(FEEDBACK_MAX_LENGTH + 1));
    expect(result.ok).toBe(false);
  });

  it("accepts a message exactly at the limit", () => {
    const result = validateFeedback("other", "x".repeat(FEEDBACK_MAX_LENGTH));
    expect(result.ok).toBe(true);
  });

  it("rejects a category the table would refuse", () => {
    // The CHECK constraint lists four; anything else is a client bug.
    const result = validateFeedback("complaint" as never, "hello");
    expect(result.ok).toBe(false);
  });
});

describe("isFeedbackCategory", () => {
  it("recognises every category the table allows", () => {
    for (const c of ["bug", "idea", "puzzle", "other"]) {
      expect(isFeedbackCategory(c)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isFeedbackCategory("praise")).toBe(false);
    expect(isFeedbackCategory("")).toBe(false);
  });
});

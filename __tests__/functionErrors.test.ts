import {
  FunctionCallError,
  isPermanentRejection,
} from "../utils/functionErrors";

/**
 * A solve rejected with 422 incomplete_solve was being queued and retried
 * forever: the same letters can never become acceptable, so "pending sync"
 * never cleared and the queue never drained.
 */
describe("isPermanentRejection", () => {
  it("treats a rejected submission as permanent", () => {
    expect(
      isPermanentRejection(
        new FunctionCallError("incomplete", 422, "incomplete_solve"),
      ),
    ).toBe(true);
  });

  it("treats other 4xx refusals as permanent", () => {
    for (const status of [400, 401, 403, 404, 409]) {
      expect(isPermanentRejection(new FunctionCallError("no", status))).toBe(
        true,
      );
    }
  });

  it("keeps retrying a timeout or a rate limit", () => {
    // Both of these are the server asking for another attempt, not refusing.
    expect(isPermanentRejection(new FunctionCallError("slow", 408))).toBe(false);
    expect(isPermanentRejection(new FunctionCallError("busy", 429))).toBe(false);
  });

  it("keeps retrying server faults", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isPermanentRejection(new FunctionCallError("oops", status))).toBe(
        false,
      );
    }
  });

  it("keeps retrying when there is no status at all", () => {
    // A fetch that never reached the server is the offline case — exactly
    // what the queue exists for. Discarding a real solve here would be far
    // worse than one wasted retry.
    expect(isPermanentRejection(new FunctionCallError("network down"))).toBe(
      false,
    );
    expect(isPermanentRejection(new Error("Failed to fetch"))).toBe(false);
    expect(isPermanentRejection(null)).toBe(false);
    expect(isPermanentRejection(undefined)).toBe(false);
  });
});

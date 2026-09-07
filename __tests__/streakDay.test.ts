import { isFirstSolveOfDay } from "../utils/streakDay";

/**
 * The streak screen fired after every completion because the app could not
 * tell the day's first solve from its fourth. These are the cases that
 * distinction turns on.
 *
 * Every fixture is explicit UTC, because that is the clock the server keeps
 * the streak on — writing them in local time would make the suite pass or
 * fail depending on where it runs.
 */
describe("isFirstSolveOfDay", () => {
  it("is true when the last play was the previous day", () => {
    expect(
      isFirstSolveOfDay(
        "2026-09-02T20:00:00.000Z",
        new Date("2026-09-03T09:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("is false for a second solve on the same day", () => {
    // The case that was broken: nothing after the first solve of the day
    // should show the streak screen again.
    expect(
      isFirstSolveOfDay(
        "2026-09-03T09:00:00.000Z",
        new Date("2026-09-03T21:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("is false across the whole of one UTC day", () => {
    expect(
      isFirstSolveOfDay(
        "2026-09-03T00:00:00.000Z",
        new Date("2026-09-03T23:59:59.000Z"),
      ),
    ).toBe(false);
  });

  it("is true one minute after UTC midnight", () => {
    expect(
      isFirstSolveOfDay(
        "2026-09-03T23:59:00.000Z",
        new Date("2026-09-04T00:01:00.000Z"),
      ),
    ).toBe(true);
  });

  it("handles a bare date, which is how the server stores it", () => {
    // users.last_played_date is a DATE column, so it arrives without a time.
    expect(
      isFirstSolveOfDay("2026-09-03", new Date("2026-09-03T18:00:00.000Z")),
    ).toBe(false);
    expect(
      isFirstSolveOfDay("2026-09-02", new Date("2026-09-03T18:00:00.000Z")),
    ).toBe(true);
  });

  it("is true when there is no recorded history", () => {
    expect(isFirstSolveOfDay(null)).toBe(true);
    expect(isFirstSolveOfDay(undefined)).toBe(true);
    expect(isFirstSolveOfDay("")).toBe(true);
  });

  it("is true rather than throwing on an unparseable date", () => {
    expect(isFirstSolveOfDay("not a date")).toBe(true);
  });

  it("is true after a long gap", () => {
    expect(
      isFirstSolveOfDay(
        "2025-01-01T00:00:00.000Z",
        new Date("2026-09-03T09:00:00.000Z"),
      ),
    ).toBe(true);
  });
});

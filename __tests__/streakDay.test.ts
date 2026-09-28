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

/**
 * The player's own day. `lastPlayedDate` arrives from the server as a calendar
 * date stored at UTC midnight ("2026-09-03T00:00:00.000Z" means the 3rd), so it
 * is read as that date and compared with today in the player's zone.
 */
describe("isFirstSolveOfDay in the player's zone", () => {
  it("is false for a US evening solve the server dated the 3rd", () => {
    // 8 PM in New York on the 3rd is already the 4th in UTC.
    expect(
      isFirstSolveOfDay(
        "2026-09-03T00:00:00.000Z",
        new Date("2026-09-04T00:00:00.000Z"),
        "America/New_York",
      ),
    ).toBe(false);
  });

  it("is true once the player's own midnight has passed", () => {
    // 5:30 AM in Kolkata on the 3rd is still the 2nd in UTC.
    expect(
      isFirstSolveOfDay(
        "2026-09-02T00:00:00.000Z",
        new Date("2026-09-02T20:00:00.000Z"),
        "Asia/Kolkata",
      ),
    ).toBe(true);
  });

  it("treats a date ahead of today as already played", () => {
    // The edge case migration 026 fixes on the server: a last-played date on
    // or after today counts as today.
    expect(
      isFirstSolveOfDay(
        "2026-09-04T00:00:00.000Z",
        new Date("2026-09-04T02:00:00.000Z"),
        "America/New_York", // still the 3rd there
      ),
    ).toBe(false);
  });

  it("stays true for a player with no history in any zone", () => {
    expect(isFirstSolveOfDay(null, new Date(), "Asia/Kolkata")).toBe(true);
    expect(isFirstSolveOfDay("garbage", new Date(), "Asia/Kolkata")).toBe(true);
  });
});

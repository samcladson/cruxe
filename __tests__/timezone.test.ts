import {
  addDays,
  dateInZone,
  deviceTimeZone,
  yesterdayInZone,
} from "../utils/timezone";

/**
 * "Today" is the player's own day. These pin the conversions the puzzle fetch
 * and the streak check rely on, at the instants where a wrong zone shows.
 */
const YMD = /^\d{4}-\d{2}-\d{2}$/;

describe("dateInZone", () => {
  const late = new Date("2026-09-28T23:30:00.000Z");
  it.each([
    ["UTC", "2026-09-28"],
    ["Asia/Kolkata", "2026-09-29"], // 05:00 next morning
    ["America/Los_Angeles", "2026-09-28"], // 16:30
    ["Pacific/Kiritimati", "2026-09-29"], // UTC+14, 13:30 next day
    ["Pacific/Pago_Pago", "2026-09-28"], // UTC-11, 12:30
  ])("%s at 23:30Z", (zone, expected) => {
    expect(dateInZone(zone, late)).toBe(expected);
  });

  it("puts a US evening on the previous UTC day", () => {
    expect(
      dateInZone("America/Los_Angeles", new Date("2026-09-28T02:00:00.000Z")),
    ).toBe("2026-09-27");
    expect(dateInZone("Asia/Kolkata", new Date("2026-09-28T02:00:00.000Z"))).toBe(
      "2026-09-28",
    );
  });

  it("flips exactly at the zone's local midnight", () => {
    // 18:30Z is 00:00 in Kolkata (UTC+5:30).
    expect(dateInZone("Asia/Kolkata", new Date("2026-09-28T18:29:59.000Z"))).toBe(
      "2026-09-28",
    );
    expect(dateInZone("Asia/Kolkata", new Date("2026-09-28T18:30:00.000Z"))).toBe(
      "2026-09-29",
    );
  });

  it("follows daylight saving", () => {
    // New York springs forward at 07:00Z on 2026-03-08.
    expect(
      dateInZone("America/New_York", new Date("2026-03-08T06:59:00.000Z")),
    ).toBe("2026-03-08");
    // 04:00Z is still the evening before in either offset.
    expect(
      dateInZone("America/New_York", new Date("2026-03-09T03:59:00.000Z")),
    ).toBe("2026-03-08");
    expect(
      dateInZone("America/New_York", new Date("2026-03-09T04:00:00.000Z")),
    ).toBe("2026-03-09");
  });

  it("falls back to a valid date for a missing or unknown zone", () => {
    expect(dateInZone(null, late)).toMatch(YMD);
    expect(dateInZone(undefined, late)).toMatch(YMD);
    expect(dateInZone("Not/AZone", late)).toMatch(YMD);
  });
});

describe("addDays / yesterdayInZone", () => {
  it("moves across month, year and leap boundaries", () => {
    expect(addDays("2026-09-28", -7)).toBe("2026-09-21");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("gives the day before, in the player's zone", () => {
    const now = new Date("2026-09-28T23:30:00.000Z");
    expect(yesterdayInZone("Asia/Kolkata", now)).toBe("2026-09-28");
    expect(yesterdayInZone("UTC", now)).toBe("2026-09-27");
  });
});

describe("deviceTimeZone", () => {
  it("returns a non-empty zone name", () => {
    expect(deviceTimeZone().length).toBeGreaterThan(0);
  });
});

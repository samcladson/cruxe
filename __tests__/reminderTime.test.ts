import {
  formatReminderTime,
  stepHour,
  stepMinute,
  REMINDER_MINUTE_STEP,
} from "../utils/reminderTime";

/**
 * The daily reminder used to be fixed at 19:00. These pin how its time is
 * moved and shown, so the picker cannot produce a time the scheduler would
 * reject (hour outside 0-23, minute outside 0-59).
 */
describe("stepHour", () => {
  it("moves by one hour", () => {
    expect(stepHour(19, 1)).toBe(20);
    expect(stepHour(19, -1)).toBe(18);
  });

  it("wraps around midnight both ways", () => {
    expect(stepHour(23, 1)).toBe(0);
    expect(stepHour(0, -1)).toBe(23);
  });
});

describe("stepMinute", () => {
  it(`moves in ${REMINDER_MINUTE_STEP}-minute steps`, () => {
    expect(stepMinute(0, 1)).toBe(REMINDER_MINUTE_STEP);
    expect(stepMinute(REMINDER_MINUTE_STEP, -1)).toBe(0);
  });

  it("wraps within the hour", () => {
    expect(stepMinute(60 - REMINDER_MINUTE_STEP, 1)).toBe(0);
    expect(stepMinute(0, -1)).toBe(60 - REMINDER_MINUTE_STEP);
  });

  it("snaps an off-step minute onto the grid before stepping", () => {
    // A stored minute from some future finer picker must not break this one.
    expect(stepMinute(7, 1)).toBe(REMINDER_MINUTE_STEP);
    expect(stepMinute(7, -1)).toBe(0);
  });
});

describe("formatReminderTime", () => {
  it("formats in the given locale's clock", () => {
    expect(formatReminderTime(19, 30, "en-US")).toBe("7:30 PM");
    expect(formatReminderTime(19, 0, "en-GB")).toBe("19:00");
  });
});

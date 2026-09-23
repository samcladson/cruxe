/**
 * Moving and showing the daily reminder's time.
 *
 * The picker steps rather than scrolls: hours one at a time, minutes on a
 * quarter-hour grid. That is enough precision for "remind me after work",
 * and every value it can produce is one the DAILY trigger accepts.
 */

export const REMINDER_MINUTE_STEP = 15;

/** One hour forward or back, wrapping at midnight. */
export function stepHour(hour: number, delta: 1 | -1): number {
  return (((hour + delta) % 24) + 24) % 24;
}

/**
 * One step forward or back on the quarter-hour grid, wrapping within the
 * hour. A minute off the grid lands on the neighbouring step in the
 * direction of travel rather than skipping past it.
 */
export function stepMinute(minute: number, delta: 1 | -1): number {
  const onGrid = minute % REMINDER_MINUTE_STEP === 0;
  const next = onGrid
    ? minute + delta * REMINDER_MINUTE_STEP
    : delta > 0
      ? Math.ceil(minute / REMINDER_MINUTE_STEP) * REMINDER_MINUTE_STEP
      : Math.floor(minute / REMINDER_MINUTE_STEP) * REMINDER_MINUTE_STEP;
  return ((next % 60) + 60) % 60;
}

/**
 * "7:30 PM" or "19:30", as the device's locale writes a time. `locale` is
 * for tests; the app leaves it out.
 */
export function formatReminderTime(
  hour: number,
  minute: number,
  locale?: string,
): string {
  const d = new Date(2000, 0, 1, hour, minute);
  return (
    d
      .toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
      // Newer ICU puts a narrow no-break space before AM/PM.
      .replace(/[\u202f\u00a0]/g, " ")
  );
}

/**
 * streakDay.ts — "is this the first puzzle finished today?"
 *
 * The answer decides whether the streak celebration appears. Getting it
 * wrong in the permissive direction shows the celebration after every single
 * puzzle, which is how it stops being one.
 */

/**
 * True when `lastPlayedDate` falls on an earlier day than `now`.
 *
 * Compared in **UTC**, deliberately. The streak itself is the server's to
 * decide, and `claim_daily_bonus` and `submit_solve` both work from
 * `(NOW() AT TIME ZONE 'UTC')::DATE`. Asking this question in local time
 * would let the client believe a new day had begun hours before the server
 * agreed, and the celebration would appear for a streak that had not
 * actually advanced.
 *
 * A missing or unparseable date counts as first-of-day: a player with no
 * recorded history who has just solved a puzzle has indeed done so for the
 * first time today.
 */
export function isFirstSolveOfDay(
  lastPlayedDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastPlayedDate) return true;

  const last = new Date(lastPlayedDate);
  if (Number.isNaN(last.getTime())) return true;

  return utcDay(last) !== utcDay(now);
}

/** YYYY-MM-DD in UTC, matching how the server dates a play. */
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

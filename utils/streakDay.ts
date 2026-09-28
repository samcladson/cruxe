/**
 * streakDay.ts — "is this the first puzzle finished today?"
 *
 * The answer decides whether the streak celebration appears. Getting it
 * wrong in the permissive direction shows the celebration after every single
 * puzzle, which is how it stops being one.
 */

import { dateInZone } from "./timezone";

/**
 * True when `lastPlayedDate` falls on an earlier day than today in `zone`.
 *
 * "Today" is the player's own day, the same one the server uses for the streak
 * (`user_today` in migration 026), so the client never believes a new day has
 * begun before the server does. `zone` is the zone the server confirmed; it
 * defaults to UTC, the server's fallback for a player with none stored.
 *
 * `lastPlayedDate` arrives as a calendar date the server stored at UTC
 * midnight, so its UTC date *is* that calendar date and is read as such. A date
 * on or after today counts as today — the edge case migration 026 also handles
 * on the server, where a US evening play is dated the next UTC day.
 *
 * A missing or unparseable date counts as first-of-day: a player with no
 * recorded history who has just solved a puzzle has indeed done so for the
 * first time today.
 */
export function isFirstSolveOfDay(
  lastPlayedDate: string | null | undefined,
  now: Date = new Date(),
  zone: string | null | undefined = "UTC",
): boolean {
  if (!lastPlayedDate) return true;

  const last = new Date(lastPlayedDate);
  if (Number.isNaN(last.getTime())) return true;

  const lastDay = last.toISOString().slice(0, 10);
  return lastDay < dateInZone(zone, now);
}

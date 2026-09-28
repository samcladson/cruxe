/**
 * timezone.ts — "what day is it for this player?"
 *
 * Everything that is dated by day — which puzzle set to show, whether a solve
 * is the first of the day — follows the player's own time zone. The server
 * decides the same question with the same zone (`user_today` in migration 026),
 * so the two always agree on the boundary.
 *
 * Dates are `YYYY-MM-DD` strings throughout, never Date objects, because a date
 * with no time is the thing being compared and a Date drags a zone back in.
 */

/** The zone the phone reports, or UTC if it will not say. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * The date at `now` in `zone`.
 *
 * A missing or unrecognised zone falls back to the phone's own local date
 * rather than throwing: a wrong-by-a-few-hours day is far better than a screen
 * that cannot load puzzles.
 */
export function dateInZone(
  zone: string | null | undefined,
  now: Date = new Date(),
): string {
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const get = (type: string) => parts.find((p) => p.type === type)?.value;
      const y = get("year");
      const m = get("month");
      const d = get("day");
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // Unknown zone name: fall through to the device's own date.
    }
  }
  return localDate(now);
}

function localDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `ymd` moved by `days` (negative goes back), as a calendar date. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  // Built and read in UTC so daylight saving cannot move the result.
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

export function yesterdayInZone(
  zone: string | null | undefined,
  now: Date = new Date(),
): string {
  return addDays(dateInZone(zone, now), -1);
}

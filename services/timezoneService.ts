/**
 * timezoneService.ts — tells the server which day this player is living in.
 *
 * Free plays, the daily bonus and streaks are enforced on the server, so it has
 * to know the player's time zone to know when their day rolls over. This
 * reports the phone's zone and keeps the one the server confirms.
 *
 * The server accepts a first zone at once and later changes only every 3 days
 * (migration 026), so the confirmed zone can trail the phone's for a short
 * while after travelling. The app therefore reads its dates in the *confirmed*
 * zone, never the phone's, so it and the server always agree.
 *
 * Fire-and-forget: offline or signed out, the app keeps the zone it has.
 */

import { useSettingsStore } from "../stores/settingsStore";
import { setTimezone } from "./economyService";
import { invalidatePuzzleCache } from "./puzzleService";
import { deviceTimeZone } from "../utils/timezone";

/** Re-report at most this often while the phone's zone has not changed. */
const REREPORT_MS = 6 * 60 * 60 * 1000;

let lastReportedZone: string | null = null;
let lastReportedAt = 0;

export async function syncTimeZone(): Promise<void> {
  const device = deviceTimeZone();
  const settings = useSettingsStore.getState();

  const recent =
    device === lastReportedZone && Date.now() - lastReportedAt < REREPORT_MS;
  if (recent && settings.timeZone) return;

  try {
    const confirmed = await setTimezone(device);
    lastReportedZone = device;
    lastReportedAt = Date.now();

    if (confirmed !== settings.timeZone) {
      settings.setTimeZone(confirmed);
      // Cached puzzle lists were fetched for the old day.
      invalidatePuzzleCache();
    }
  } catch (e) {
    // Offline, or not signed in yet. The next launch or foreground retries.
    console.warn("[Timezone] Could not report the time zone:", e);
  }
}

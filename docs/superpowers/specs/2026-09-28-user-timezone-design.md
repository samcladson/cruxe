# Player-local days — design

**Date:** 2026-09-28. **Status:** approved in chat; review pauses skipped at the
owner's request ("yes and also fix the edge case and build it").

## Goal
Every player's day starts at *their* local midnight. The puzzle set, free plays,
daily bonus, streaks and reminders all follow the player's own time zone.
Generation is untouched: it already runs three days ahead, which covers every
zone (UTC+14 needs one day ahead, UTC-12 needs the day before).

## Why the server needs the zone
Free plays, the daily bonus, streaks and streak repair are enforced by the
server so a modified phone cannot award itself coins. They decided "what day is
it" in UTC. Making only the puzzle set local would leave those rules resetting at
a different hour from the set. Puzzle *fetching* needs nothing from the server:
the app asks for the row dated its own today.

## Rule for trusting a zone
The server stores an IANA zone per user and uses it for every "today".
- The first zone is accepted immediately.
- A change is accepted only if the last change was 3+ days ago; otherwise the
  stored zone stays. This stops flipping the phone's zone to claim the daily
  bonus or advance a streak more than once a day, while travellers are correct
  after a short wait.
- Names are validated against `pg_timezone_names`.
- No stored zone means UTC, so old app builds and existing users behave exactly
  as before until an updated app reports a zone.

## Server
- `users.timezone`, `users.timezone_changed_at`.
- `user_today(user_id)` → the date in that user's zone.
- `set_timezone(zone)` → the zone now in effect.
- `claim_daily_bonus`, `enter_puzzle`, `get_play_status`, `submit_solve`,
  `get_streak_status`, `repair_streak` use `user_today`. `resets_at` becomes the
  player's next local midnight.
- **Edge case:** a last-played date on or after today counts as played today.
  Without this a player whose earlier play was dated "tomorrow" in UTC (US
  evenings, or moving west) would have their streak broken at the switch.
- The daily challenge is a flag on the puzzle row, so it is unaffected.

## App
- Reports the phone's zone at launch and when it changes; failures are ignored.
  Stores the zone the server confirms and uses it for every date.
- `puzzleService` asks for "today" and "yesterday" in that zone instead of UTC.
- `isFirstSolveOfDay` compares days in that zone so it agrees with the server.
- If the zone cannot be resolved, the device's own local date is used.

## Reminders and wording
The daily reminder already fires on the phone's clock. The 6 PM streak warning
becomes accurate because the streak day now ends at local midnight. The existing
copy ("midnight") is now true and unchanged.

## Rollout and testing
Migration first: compatible with old builds because everyone starts on UTC.
Unit tests cover the date helpers (zones, day boundary, DST). The database rules
are checked with SQL run inside a rolled-back transaction against the live
project. The on-device result needs an iPhone and a build.

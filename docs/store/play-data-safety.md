# Google Play Data Safety — answer sheet

Fill the Play Console **Data safety** form with these answers. They are derived
from what the code actually does, not from what would be convenient to declare.
A mismatch between this form and the app's real behaviour is a policy
violation, and it is checked.

Re-verify this document whenever a third-party SDK is added or removed.

**Last derived:** 2026-09-02, against commit on `master` after sub-project 5.

---

## Does your app collect or share any of the required user data types?

**Yes.**

---

## Data types

### Personal info → Name

| Question | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| Processing | Not ephemeral (stored) |
| Required or optional | **Optional** |
| Purpose | App functionality; Account management |

Why: `users.display_name` is shown on the public leaderboard. It defaults to
"Player" and is only meaningful if the user sets it, or if a linked Google
account supplies one.

### Personal info → Email address

| Question | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| Processing | Not ephemeral |
| Required or optional | **Optional** |
| Purpose | Account management |

Why: only if the user chooses to link a Google account. Anonymous play is the
default and collects no email. Supabase Auth stores it.

### Personal info → User IDs

| Question | Answer |
|---|---|
| Collected | **Yes** |
| Shared | **Yes** (RevenueCat, Sentry) |
| Processing | Not ephemeral |
| Required or optional | **Required** |
| Purpose | App functionality; Account management; Crash logs |

Why: every install gets an anonymous Supabase UUID. It is sent to RevenueCat
(as `app_user_id`, to attribute purchases) and to Sentry (to correlate one
user's crashes). Both are processors acting on our behalf.

### Financial info → Purchase history

| Question | Answer |
|---|---|
| Collected | **Yes** |
| Shared | No |
| Processing | Not ephemeral |
| Required or optional | **Optional** |
| Purpose | App functionality |

Why: `iap_events` and `coin_ledger` record coin-pack purchases so a grant can
be reconciled and a refund honoured. No payment card data is ever seen by the
app — Google Play handles the transaction.

### App activity → In-app search history

**Not collected.** There is no search.

### App activity → Other actions

| Question | Answer |
|---|---|
| Collected | **Yes** |
| Shared | **Yes** (Sentry) |
| Processing | Not ephemeral |
| Required or optional | **Required** |
| Purpose | Analytics; Crash logs |

Why: the analytics funnel in `services/analyticsService.ts` records 13 events
(puzzle started/completed/abandoned, hint used, store viewed, purchase
started/completed/failed, and so on). They are attached to Sentry crash
reports as breadcrumbs. Gameplay results are also stored in
`puzzle_completions` for the leaderboard.

### App info and performance → Crash logs

| Question | Answer |
|---|---|
| Collected | **Yes** |
| Shared | **Yes** (Sentry) |
| Processing | Not ephemeral |
| Required or optional | **Required** |
| Purpose | Crash logs |

### App info and performance → Diagnostics

| Question | Answer |
|---|---|
| Collected | **Yes** |
| Shared | **Yes** (Sentry) |
| Processing | Not ephemeral |
| Required or optional | **Required** |
| Purpose | Crash logs; Analytics |

Why: Sentry captures device model, OS version, and performance traces at a 20%
sample rate. **Device *name* is explicitly scrubbed** in `beforeSend`, because
users routinely put their real name in it.

### Device or other IDs

**Not collected.** No advertising ID, no device fingerprint. There is no ads
SDK — the app is IAP-only by deliberate decision.

---

## Everything NOT collected

Declare these as not collected: location (any precision), health and fitness,
messages, photos and videos, audio files, voice or sound recordings, music,
files and docs, calendar, contacts, web browsing history, installed apps,
SMS, call logs, advertising ID.

Note on audio: `expo-av` declares `RECORD_AUDIO` in its own manifest, but the
app blocks it (`android.blockedPermissions` in `app.json`) and only ever plays
bundled sound effects. Nothing is recorded.

---

## Security practices

| Question | Answer |
|---|---|
| Is data encrypted in transit? | **Yes** — all traffic to Supabase, RevenueCat and Sentry is HTTPS |
| Can users request data deletion? | **Yes** |
| Deletion URL | *(the hosted `web/account-deletion.html`, once published)* |
| Independent security review | No |

Deletion is available in-app at **Profile → Delete account**, which calls the
`delete-account` Edge Function. That removes the auth user, and foreign-key
cascades clear the profile, ledger, hint events, puzzle entries, and
completions.

---

## Before you submit

- [ ] Publish `web/account-deletion.html` and paste its URL into the form
- [ ] Publish a privacy policy URL and paste it into the store listing
- [ ] Re-read this file if any SDK has changed since the "last derived" date
- [ ] Confirm the in-app privacy policy (`app/legal/privacy.tsx`) names the
      same processors: Supabase, RevenueCat, Google/Apple Sign-In, Sentry

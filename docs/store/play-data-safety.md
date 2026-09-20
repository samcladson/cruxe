# Google Play Data Safety — fill-in sheet

Follow this **in the order the Play Console asks**. Every answer is derived
from what the code does, not from what would be convenient to declare. A
mismatch between this form and the app's real behaviour is a policy
violation, and Google does check it.

**Last derived:** 2026-09-20, verified against `master` at `dd587bf`.

Re-derive whenever an SDK is added or removed. The SDKs that touch user data
today are exactly: `@supabase/supabase-js`, `@sentry/react-native`,
`react-native-purchases`, `@react-native-google-signin/google-signin`,
`expo-apple-authentication`, `expo-notifications`.

> **Changed since 2026-09-02** — submitting the old answers would now be a
> misdeclaration:
> - **Email address: Optional → Required.** An account is mandatory and all
>   three ways of creating one involve an address.
> - **New: Personal info → Other info**, for the feedback form's free text.

---

## Step 1 — Data collection and security

| Prompt | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — every call to Supabase, RevenueCat and Sentry is HTTPS |
| Do you provide a way for users to request that their data is deleted? | **Yes** |
| Deletion URL | `https://samcladson.github.io/cruxe/account-deletion.html` |

Deletion is also in-app at **Profile → Account & Sync → Delete account**,
which calls the `delete-account` Edge Function. That removes the auth user;
foreign-key cascades clear the profile, ledger, hint events, completions and
feedback.

---

## Step 2 — Tick exactly these data types

**Personal info:** Name · Email address · User IDs · Other info
**Financial info:** Purchase history
**App activity:** Other actions
**App info and performance:** Crash logs · Diagnostics

Leave **everything else unticked**, including: Address, Phone number, Race
and ethnicity, Political or religious beliefs, Sexual orientation, Payment
info, Credit score, Location (any precision), Messages of any kind, Photos,
Videos, Audio, Music, Voice or sound recordings, Files and docs, Calendar,
Contacts, App activity → In-app search history / Installed apps / Other
user-generated content, Web browsing history, Device or other IDs.

Two worth knowing the reason for, because a reviewer may ask:

- **Device or other IDs — not collected.** No advertising ID, no device
  fingerprint, no push token. There is no ads SDK; the app is IAP-only by
  decision. `expo-notifications` is used for *local* reminders only and never
  calls `getExpoPushTokenAsync`.
- **Audio — not collected.** `expo-av` declares `RECORD_AUDIO` in its own
  manifest, but `android.blockedPermissions` in `app.json` strips it and the
  app only plays bundled sound effects.

---

## Step 3 — Answer per data type

Every type below is **not ephemeral** (it is stored), so that column is
omitted. "Shared" means it leaves our control to a third party.

### Personal info → Name

| | |
|---|---|
| Collected | Yes |
| Shared | No |
| Required or optional | **Optional** |
| Purposes | App functionality, Account management |

`users.display_name` appears on the public leaderboard. It defaults to
"Player"; it is only meaningful if the user sets it or a provider supplies it.

### Personal info → Email address

| | |
|---|---|
| Collected | Yes |
| Shared | No |
| Required or optional | **Required** |
| Purposes | Account management |

An account is required to play. Google and Apple supply an address with the
identity; the email one-time-code path takes it directly. Supabase Auth
stores it. Apple's "Hide My Email" yields a private relay address — still an
email address for this form.

### Personal info → User IDs

| | |
|---|---|
| Collected | Yes |
| Shared | **Yes** — RevenueCat, Sentry |
| Required or optional | **Required** |
| Purposes | App functionality, Account management, Crash logs |

Every account has a Supabase UUID. It goes to RevenueCat as `app_user_id` to
attribute purchases, and to Sentry to correlate one user's crashes. Both are
processors acting on our behalf.

### Personal info → Other info

| | |
|---|---|
| Collected | Yes |
| Shared | No |
| Required or optional | **Optional** |
| Purposes | App functionality, Customer support |

The feedback form (**Profile → Send feedback**) stores what the user writes,
with their account id, app version and platform. It is free text, so it may
contain anything including personal information — which is why it is declared
rather than treated as telemetry.

It is **not** "Other user-generated content": feedback goes only to the
developer and is never shown to other users. The table has an INSERT policy
and no SELECT policy at all, so not even its author can read it back.

### Financial info → Purchase history

| | |
|---|---|
| Collected | Yes |
| Shared | No |
| Required or optional | **Optional** |
| Purposes | App functionality |

`iap_events` and `coin_ledger` record coin-pack purchases so a grant can be
reconciled and a refund honoured. **No payment card data ever reaches the
app** — Google Play handles the transaction.

### App activity → Other actions

| | |
|---|---|
| Collected | Yes |
| Shared | **Yes** — Sentry |
| Required or optional | **Required** |
| Purposes | Analytics, Crash logs |

`services/analyticsService.ts` emits 13 events: `onboarding_started`,
`onboarding_completed`, `tutorial_skipped`, `first_solve`, `puzzle_started`,
`puzzle_completed`, `puzzle_abandoned`, `hint_used`, `store_viewed`,
`purchase_started`, `purchase_completed`, `purchase_failed`,
`daily_bonus_claimed`.

They route to **Sentry breadcrumbs only** — there is no product-analytics
vendor, so no second consent surface. Gameplay results are also stored in
`puzzle_completions` for the leaderboard.

### App info and performance → Crash logs

| | |
|---|---|
| Collected | Yes |
| Shared | **Yes** — Sentry |
| Required or optional | **Required** |
| Purposes | Crash logs |

### App info and performance → Diagnostics

| | |
|---|---|
| Collected | Yes |
| Shared | **Yes** — Sentry |
| Required or optional | **Required** |
| Purposes | Crash logs, Analytics |

Sentry captures device model, OS version and performance traces at a 20%
sample rate. **Device *name* is explicitly scrubbed** in `beforeSend`
(`app/_layout.tsx`), because users routinely put their real name in it.

---

## Step 4 — Before you submit

- [ ] Publish the legal pages and confirm the deletion URL above actually
      resolves. A 404 there is a rejection.
- [ ] Paste the privacy policy URL into the **store listing** (a different
      field from this form)
- [ ] Confirm `app/legal/privacy.tsx` and the hosted `web/privacy.html` name
      the same processors: Supabase, RevenueCat, Google/Apple Sign-In, Sentry
- [ ] Confirm both mention the feedback form and that an email address is
      required
- [ ] Ads declaration (also a separate field): **contains no ads**

# App Store Connect — App Privacy labels

Walkthrough for App Store Connect → the app → **App Privacy**. Same facts as
`play-data-safety.md` (read its "SDKs that touch user data" list first), mapped
onto Apple's different categories and its extra *tracking* question. A mismatch
between this form and what the app does is grounds for rejection, so re-derive
whenever an SDK is added or removed.

**Last derived:** 2026-09-28 against `master`.

## The tracking question

**Do you or your third-party partners use data from this app for tracking?**
→ **No.** No ad SDK, no advertising identifier, no data sold or passed to data
brokers, and no App Tracking Transparency prompt. Because the answer is No,
**no `NSUserTrackingUsageDescription`** is needed in `app.json`, and none is set.

## Data types to declare

Every type below is **Linked to the user** (each is tied to the Supabase
account id) and **not used for tracking**.

| Category | Data type | Purposes | Why |
|---|---|---|---|
| Contact Info | **Email Address** | App Functionality | Required to create an account by any of the three methods. Apple's Hide My Email yields a private relay address, which still counts. |
| Contact Info | **Name** | App Functionality | The display name on the public leaderboard, or the name a provider supplies. |
| Identifiers | **User ID** | App Functionality, Analytics | Supabase UUID; sent to RevenueCat to attribute purchases and to Sentry to group one user's crashes. |
| Purchases | **Purchase History** | App Functionality | `iap_events` and `coin_ledger` record coin-pack purchases so grants and refunds reconcile. No card data reaches the app. |
| User Content | **Customer Support** | App Functionality | The Send feedback form's free text, stored with account id, app version and platform. Never shown to other players, so not "Other User Content". |
| Usage Data | **Product Interaction** | Analytics | The 13 events in `analyticsService.ts` (puzzle started/completed, hint used, store viewed and so on), routed to Sentry breadcrumbs only. Scores and completions also feed the leaderboard. |
| Diagnostics | **Crash Data** | App Functionality | Sentry crash reports. |
| Diagnostics | **Performance Data** | App Functionality, Analytics | Sentry traces at a 20% sample rate. |
| Diagnostics | **Other Diagnostic Data** | App Functionality | Device model and OS version. Device *name* is scrubbed in `beforeSend` (`app/_layout.tsx`). |

## Leave unticked

Health and Fitness, Financial Info (no card or payment info ever reaches the
app), Location, Sensitive Info, Contacts, Browsing History, Search History,
Photos or Videos, Audio Data, Gameplay Content, Other User Content, Device ID,
Advertising Data, Other Data Types.

Two a reviewer may ask about:

- **Device ID — not collected.** No advertising identifier and no device
  fingerprint. `expo-notifications` schedules *local* reminders only and never
  requests a push token.
- **Audio Data — not collected.** The app only plays bundled sound effects.
  `NSMicrophoneUsageDescription` is not present because `expo-audio` runs with
  `microphonePermission: false`.

## Before you submit

- [ ] Privacy Policy URL is set on the listing (a different field from this
      form): `https://samcladson.github.io/cruxe/privacy.html`
- [ ] Confirm the hosted page still names the same processors as this sheet:
      Supabase, RevenueCat, Sentry, Google/Apple Sign-In
- [ ] The build's Info.plist has no permission strings for anything ticked
      "not collected" above (`eas build` output or the `.ipa`'s Info.plist)

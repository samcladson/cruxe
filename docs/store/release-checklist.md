# Cruxe — store release checklist

Android and iOS are now parallel tracks. The Apple Developer account exists
as of 2026-09-23, so §8 is unblocked and its slow, serial steps (Service ID,
App Store Connect record, TestFlight processing) should be started alongside
the Android work rather than after it.

Ordered by dependency: each section unblocks the next. Items marked
**[blocked]** are waiting on something outside the codebase.

**Last revised:** 2026-09-28 (iOS readiness audit, §8e; iOS sound fix; iPhone
added to the landing page); 2026-09-25 (internal testing live, store listing details
reported complete); 2026-09-23 (Apple account, Gemini model swap); 2026-09-21,
after confirming §1b live against the Supabase project directly (REST probes
and the public GoTrue settings endpoint, not just "the migration file
exists") and publishing the legal pages.

---

## 1. Account and payments

- [ ] **[blocked]** Play Console → Setup → **Payments profile** verified
      *(submitted 2026-09-02; verification takes days)*. Per Google, this step
      needs a **deployed/public app URL** to complete — internal testing is
      now live (2026-09-25), so this should be unblocked; go back and submit
      that link on the payments profile form if it wasn't already prompted.
- [ ] Developer account details complete (name, address, contact email)

Nothing in section 3 can be finished until the payments profile clears,
because real in-app products cannot be created without it.

## 1b. Outstanding engineering

- [x] ~~Run migrations 014 then 015~~ — **verified applied**: `streak_repairs`
      exists and `repair_streak` answers `not_authenticated` rather than 404.
- [x] Migrations 017 (drop the hand-added `test.coins.500`) and 018
      (`coin_ledger` → `supabase_realtime`) applied
- [x] **Migration 019 applied** — anonymous accounts removed. Confirmed live:
      `GET /auth/v1/settings` reports `external.anonymous_users: false`, so
      the dashboard toggle (the part SQL alone can't do) is also off.
- [x] **Migration 020 applied** — `feedback` table exists: probing it returns
      `42501 permission denied`, not "relation does not exist."
- [x] **Migrations 021 + 022 applied** — the `fact_unlock` coin_reason value
      and the `unlock_fact` function both exist: calling the RPC now returns
      `42501 permission denied for function`, not PostgREST's "could not
      find the function."
- [x] **Migration 023 applied** — `coin_products.coins` reads back
      300 / 1800 / 3900 / 9000, the exact rescaled amounts.
- [x] **Supabase → Authentication → Providers → "Allow anonymous sign-ins"
      is off** — confirmed via the live settings endpoint, not just assumed.
- [x] **Supabase → Authentication → Providers → Email is on** — confirmed the
      same way (`external.email: true`).
- [x] **Supabase CAPTCHA confirmed disabled** — checked manually in
      Authentication → Settings, per user report 2026-09-26. It protects the
      *signup* endpoint, and both `signInWithOtp({ shouldCreateUser: true })`
      and a first-time `signInWithIdToken` are signups — with CAPTCHA on, no
      new account could be created by any method, so this was worth confirming
      before real testers signed up.
- [x] **Google Sign-In fixed** — verified end to end on a real device
      (Google sign-in → tutorial → home). `external.google: true` on the
      live project too.
- [ ] Re-run `npx jest __tests__/integration` against the post-019 schema.
      Not run as part of this check: it signs real users into the shared
      live project, and doing that without asking first risked leaving test
      rows or spending test economy state on the project you're about to
      ship. Worth running deliberately before §7.

## 2. Build

- [x] `eas.json` production profile: app-bundle, `autoIncrement`
- [x] `app.json`: `versionCode`, dark splash and adaptive-icon backgrounds
- [x] `RECORD_AUDIO` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` blocked —
      `expo-audio` declares both, the app only plays short sound effects
      (no recording, no background playback, so no foreground-service
      declaration is needed in Play Console)
- [x] `EXPO_PUBLIC_SENTRY_DSN` present in the EAS build environment
- [x] `SENTRY_AUTH_TOKEN` set as an EAS **secret**
- [x] **EAS `production` environment holds the real Android RevenueCat key**
      (`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`, a `goog_…` public SDK key,
      set 2026-09-21 and confirmed with `eas env:list production`). `.env`
      keeps the `test_…` key for local development on purpose. A production
      build configured with a Test Store key refuses to start purchases
      (see `initRevenueCat`). The iOS key (`appl_…`) is still to be set — see §8b.
- [x] **Every `EXPO_PUBLIC_*` value the app reads is in EAS**, for both the
      `production` and `preview` environments. EAS builds from git-tracked
      files, and `.env` is git-ignored, so a value that exists only in `.env`
      is simply absent from the build. Version code 4 shipped without
      `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` and closed on launch
      (`createClient("", "")` throws at import); confirmed by extracting its JS
      bundle, which held the `goog_` key and Sentry DSN but no Supabase URL.
      Fixed 2026-09-22. **When adding a new `EXPO_PUBLIC_` variable, add it to
      EAS too** (`eas env:create`), not just `.env`. The Gemini key stays out:
      only the generation scripts use it.
- [x] `npx eas build --platform android --profile production` succeeds *and the
      build opens*. Version code 5 (2026-09-22), installed from the internal
      testing track (installer `com.android.vending`), opens and stays open
      with no crash in logcat. Version code 4 crashed on launch (above). A
      first report that v5 also closed turned out to be an older install: the
      same bundle sideloaded ran fine, and a fresh install from Play did too.
- [x] **Signing SHA-1s registered with Google** as Android OAuth clients for
      `com.cruxe.app`. Google Sign-In fails with `DEVELOPER_ERROR` for any
      unregistered package + SHA-1 pair, and each key signs a different kind of
      install:
      - `5E:8F:16:06:…:F6:25` — debug key, dev builds
      - `2F:0D:9D:E5:…:D8:94` — EAS upload key, builds installed from EAS
      - `31:FC:DB:DC:18:48:73:AB:CA:B3:BE:25:63:5B:C7:43:9F:B5:E8:E8` — **Play
        App Signing**, anything installed from Play (added 2026-09-22 as
        "Android production"). Found under Protected with Play → Play Store
        protection, or the bundle's Downloads tab.
      - `D4:99:27:6F:…:57:90` — internal app sharing only; not registered.
- [ ] Install the resulting AAB/APK and complete a full run-through (§6)

## 3. In-app products **[blocked on §1]**

The **purchase → webhook → ledger → balance** chain is proven end to end
against the RevenueCat **Test Store**, which needs no Play Console. What
remains is proving Google Play Billing itself.

- [x] Webhook wired to
      `https://mgcuhtqqgdygdfvoirwk.supabase.co/functions/v1/revenuecat-webhook`
      with the shared secret, sandbox events enabled
- [x] End-to-end purchase verified on device via Test Store
- [ ] Create four consumables in Play Console with these **exact** IDs —
      they must match `coin_products`, and an unknown SKU is rejected by
      `credit_purchase` rather than guessed at:
      - `com.cruxe.coins.starter` — $0.99
      - `com.cruxe.coins.plus` — $4.99
      - `com.cruxe.coins.pro` — $9.99
      - `com.cruxe.coins.elite` — $19.99
- [ ] **Activate** each one. New products default to inactive, and an inactive
      product returns nothing to the app — the most common cause of "the store
      is empty" on Android.
- [x] Imported into RevenueCat and attached, alongside the Test Store
      products, to the four packages of the `default` offering, so one
      Current offering serves both the `test_` and `goog_` keys. *(Starter
      and Plus confirmed from a screenshot; Pro and Elite reported.)*
- [ ] Swap the app to the production RevenueCat key and repeat the purchase
- [ ] Force-quit immediately after a purchase and confirm the coins still
      arrive — this is what the webhook exists to guarantee
- [ ] Confirm **Restore Purchases** credits a dropped webhook
      (`sync-purchases` needs `REVENUECAT_SECRET_API_KEY`, the `sk_…` key)

## 4. Store listing

- [x] App name, short description, full description, "what's new"
      — in `docs/store/listing-copy.md`, paste-ready
- [x] **Feature graphic** 1024×500 — `assets/brand/png/play-feature-graphic.png`
- [x] **Screenshots** — six 1080×1920 images in `assets/store/screenshots/`,
      built by `npm run brand:store` from the web page's screens section (the
      same images from `web/assets/screens/`, same phone frame and captions),
      24-bit PNG, no alpha. **Uploaded to Play Console** (2026-09-25).
- [ ] **Retake two captures**: replace them in `web/assets/screens/` and rerun
      `npm run brand:store`. The takeaway
      (after the LessonScreen fix below, so the paragraph shows in full) and the
      solved screen (the current one shows 33% accuracy).
- [ ] **Confirm the takeaway fix on a device.** The stored takeaway was complete
      (390 characters, ending "…interactive PLAY.") but the last line was
      clipped on screen. `LessonScreen` now wraps a plain Text in the animated
      view and no longer sets `textAlign: "justify"`; whether that cures it is
      unconfirmed until it is seen on Android.
- [x] App icon 512×512 — `assets/brand/png/play-store-icon-512.png`
- [x] Category: Games → Word — set 2026-09-25
- [x] Content rating questionnaire — completed 2026-09-25
- [x] Target audience: not directed at children — declared 2026-09-25

## 5. Policy and compliance

- [x] Pages written: `web/index.html`, `privacy.html`, `terms.html`,
      `account-deletion.html`
- [x] **Published** — all four routes return 200:
      https://samcladson.github.io/cruxe/privacy.html ·
      /terms.html · /account-deletion.html · /
- [ ] Paste the privacy URL into the listing, and the deletion URL into the
      Data safety form — confirm both links were included when the form
      below was completed; if not, go back and add them
- [x] Complete the Data safety form using `docs/store/play-data-safety.md`
      — completed 2026-09-25
- [x] **Hosted pages match the in-app versions** — checked the live page for
      leftover "anonymous"/"guest" language from before accounts were
      required; none found.
- [x] Confirm both name the same processors: Supabase, RevenueCat,
      Google/Apple Sign-In, Sentry — done by `fix(legal)` (c7fde2b) and
      checked 2026-09-23: `app/legal/privacy.tsx` and `web/privacy.html`
      now name the same five. Re-check if either file is edited alone.
- [ ] Ads declaration: **contains no ads** — IAP-only by decision

## 6. Pre-launch verification

Run against a real build, not the dev client.

**2026-09-21: auth, gameplay and accessibility spot-checked on a real dev
build** — sign-in, solving a puzzle, and TalkBack navigation all confirmed
working hands-on. This is real coverage of the *app logic*, but a dev client
is debug-signed and connects to Metro; it does not exercise the
release-signed production build, its `eas.json` production env vars, or the
SHA-1 that Google Sign-In checks against in that build specifically.

**2026-09-26: re-run against the actual release-signed build**, per user
report — downloaded from the internal testing track (not the dev client)
and features/functionality tested hands-on, working. The general checkboxes
below are marked done on that basis. A few are specifically contrived edge
cases (airplane mode, force-quitting mid-purchase, rolling `last_played_date`
back to break a streak, TalkBack) that ordinary use of the app is unlikely to
exercise on its own — left open below pending confirmation those were
deliberately tried, rather than assumed from general testing.

**Auth — all new, none of it previously verified:**

- [x] Cold start with no session lands on **welcome**, not the tabs
- [x] Google sign-in → tutorial → home, on a fresh install
- [ ] **Email code**: request, receive, enter, land in the app. This is the
      fallback that makes Google non-fatal, so it has to be proven. Not
      confirmed specifically tried — a deliberate alternative to Google,
      easy to skip during general testing.
- [ ] A wrong or expired code is refused without stranding the screen
- [ ] Sign out returns to welcome; signing back in restores coins and streak
- [ ] Delete account removes the row and the next launch shows welcome —
      destructive and one-way, unlikely to have been tried casually
- [x] Profile → Account & Sync shows the right account identity

**Gameplay:**

- [x] Tutorial teaches the reverse-direction mechanic and the arrow appears
- [x] Solve a real puzzle: score and coins arrive from the server
- [ ] Airplane mode solve shows "Pending" and syncs on reconnect
- [ ] Hint with insufficient coins is refused **and reveals nothing**
- [ ] Five free plays, then the sixth charges — needs six puzzles in one day
- [x] Daily challenge is free and does not consume a free play
- [x] **CHECK is disabled until you type a letter of your own** (pre-filled
      letters must not enable it)
- [x] **Keyboard**: the active row stays visible, and the grid does not draw
      over the title or clue bar
- [x] **Clue sheet**: the chevron raises it to half screen and it scrolls
- [ ] A solved puzzle in today's collection opens its **result**, not a
      replayable grid
- [ ] Break a streak (set `last_played_date` back two days): the repair
      prompt appears and the first repair each month is free
- [ ] Turning on the daily reminder prompts for permission and fires
- [ ] Sentry receives a release-build crash with breadcrumbs attached
- [ ] **Send feedback** submits successfully — the RLS policy is insert-only,
      and a policy that is too tight fails exactly like a network error
- [ ] TalkBack: the grid is navigable and squares are announced with position
- [x] **Typing stays on one axis.** Type through an intersection — the
      highlight must not jump. Backspace back through it — same.

## 7. Release

- [x] Upload to **internal testing** first (`eas submit` is configured for the
      internal track, draft status) — live 2026-09-25
- [x] Add testers, install from the Play link, repeat §6 — 6 internal testers
      added and testing as of 2026-09-26
- [ ] Promote to production — hold until the still-open §6 items above and
      the §1/§3 payments/IAP chain are resolved

## 8. iOS

This section used to read "the app code is ready; none of this is app work."
That was wrong: reading the repo on 2026-09-23 turned up four config gaps,
all now fixed (§8a). It also listed only the portal steps, omitting the Paid
Apps agreement, the App Privacy labels, screenshots, and the fact that an
app requiring an account has no obvious way to give a reviewer one (§8c).

### 8a. Config — done 2026-09-23

- [x] `expo-apple-authentication` installed, `usesAppleSignIn: true`
- [x] `signInWithApple()` implemented with SHA-256 nonce replay protection and
      first-authorisation name capture, gated to `Platform.OS === "ios"`
- [x] **`ITSAppUsesNonExemptEncryption: false`** in `app.json` → `ios.infoPlist`.
      Without it every TestFlight build stalls in App Store Connect waiting
      for the export-compliance question to be answered by hand.
- [x] **`supportsTablet: false`.** It was `true`, which is a promise: Apple
      reviews on iPad and iPad screenshots become mandatory. Every font size
      in the app is a fixed number and the layout is phone-tuned, so this was
      an accidental commitment, not a decision. Revisit deliberately later.
- [x] **`iosClientId` passed to `GoogleSignin.configure()`**, from
      `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Android needs only its package +
      SHA-1 registered; iOS must be handed its own client id at configure
      time, and without it Google Sign-In fails on iOS the way Android failed
      with `DEVELOPER_ERROR`.
- [x] `submit.production.ios` block in `eas.json` — with `TODO_` placeholders
      for `appleId` / `ascAppId` / `appleTeamId`, so `eas submit` fails loudly
      naming the missing value rather than prompting for it silently.

### 8b. Portal setup

Apple's serial steps are slow. Start the agreement and the Service ID first.

- [x] Apple Developer Program membership — enrolled 2026-09-23
- [x] **Paid Apps agreement signed, plus tax and banking details** — done
      2026-09-26, per user report. Unblocks §3-equivalent IAP work below.
- [x] **iOS OAuth client** in Google Cloud for bundle id `com.cruxe.app`
      (client `1042059769347-p6oacv3c…`), same project as the Android clients.
      - [x] `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` set in `.env` and in EAS
            (`production`, `preview`, `development`) — 2026-09-28
      - [x] `iosUrlScheme` in `app.json` is now the **reversed iOS client id**
            (it held the reversed *web* id before)
      - [ ] **Needs a new iOS build** (the URL scheme is native), then confirm
            Google sign-in on the device. If Supabase rejects the token with an
            audience error, add the iOS client id to Supabase → Authentication →
            Providers → Google → Authorized Client IDs.
- [x] **Apple provider enabled in Supabase** — confirmed live 2026-09-23:
      `GET /auth/v1/settings` reports `external.apple: true`, the same way
      §1b confirmed the others, not just "the toggle looked on."
- [x] **Client IDs field confirmed correct** — verified 2026-09-26 via
      `supabase config diff` (reads the live project config, not just the
      public settings endpoint): `auth.external.apple.client_id` is
      `"com.cruxe.app"` and `auth.external.apple.enabled` is `true`. **No
      dashboard change needed** — Apple auth is fully configured server-side.
      (Same check also confirmed the Google provider's `client_id` matches
      the web OAuth client already in use.)
      **No Service ID and no `.p8` secret key** needed — `signInWithApple()`
      uses `signInWithIdToken`, the native flow, where Supabase only verifies
      the token's `aud` against Client IDs. The key becomes necessary only if
      Apple sign-in is ever added to the web build or to Android.
- [x] App Store Connect app record, bundle id `com.cruxe.app` — done, per
      user report 2026-09-26
- [x] Four consumables created in App Store Connect — done 2026-09-26.
      **`com.cruxe.coins.starter` could not be reused**: it was created,
      deleted to fix a typo'd description, and Apple permanently retires a
      deleted product id. iOS uses `com.cruxe.coins.starter2` instead;
      Android keeps the original. See migration
      `025_ios_starter_product_id.sql` (applied live 2026-09-26) — the app
      buys through RevenueCat Packages, never a hardcoded id, so this
      required no client code change, only this extra `coin_products` row:
      | Product ID | Reference name | Price | Coins |
      |---|---|---|---|
      | `com.cruxe.coins.starter2` *(iOS only — see note above)* | Starter Pack | $0.99 | 300 |
      | `com.cruxe.coins.plus` | Plus Pack | $4.99 | 1,800 |
      | `com.cruxe.coins.pro` | Pro Pack | $9.99 | 3,900 |
      | `com.cruxe.coins.elite` | Elite Pack | $19.99 | 9,000 |
      **Still open**: all 4 are in **"Missing Metadata"** — each needs a
      review screenshot (any screenshot of the shared `store.tsx` screen,
      from either platform, reused across all 4 — Apple's IAP screenshot is
      for App Review reference only, never shown to customers) plus a short
      review note, before they reach "Ready to Submit." Deferred for now;
      needed before Sandbox purchase testing will work.
- [x] RevenueCat App Store app created (In-App Purchase key + a separate
      App Store Connect API key for the product import, both `.p8`), 4
      products imported — done 2026-09-26. **Confirm**: products attached to
      the matching packages in the same `default` offering used by Play and
      Test Store (Starter package → `com.cruxe.coins.starter2` for the App
      Store product specifically, unlike the other 3 which match Android).
- [x] `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (`appl_znybrmKwCssvYoGeHWySGHXnVql`)
      set in EAS **production** and **preview** — confirmed via
      `eas env:list` 2026-09-26.
- [x] Fill the three `TODO_` values in `eas.json` — done 2026-09-26
      (`appleId`, App Store Connect's numeric app id `6816198273` for
      `ascAppId`, and Team ID `RH92B5F87N` for `appleTeamId`)

### 8c. Review submission

- [ ] **App Privacy labels** in App Store Connect. Same underlying facts as
      `play-data-safety.md`, different form — and Apple asks one question Play
      does not: *Data Used to Track You*. The answer is **none** (no ads, no
      ad SDK, no ATT prompt, nothing shared with data brokers). Processors are
      the same four: Supabase, RevenueCat, Google/Apple Sign-In, Sentry.
- [ ] **App Review notes: say no demo account is needed.** An account is
      required to play and there is no password auth — only Google, Apple, and
      an emailed code. A reviewer cannot receive the OTP and will not sign in
      with a Google account handed to them, so the only path that works is the
      one already on the device. Write, verbatim:

      > No demo account is required. On the welcome screen, tap **Sign in with
      > Apple** and use the reviewer Apple ID already signed in on the device.
      > Google sign-in and an emailed one-time code are alternatives.

      Without this note the app is rejected under 2.1 for an unusable login,
      and the rejection text will not explain why.
- [ ] **Screenshots.** Two routes, either is accepted:
      - *Real captures straight from the iPhone* (a borrowed 11 Pro Max makes
        1242×2688, Apple's 6.5" size) upload as they are, no processing.
      - *Framed marketing set*: `npm run brand:store:ios` writes 1320×2868
        (6.9") to `assets/store/screenshots-ios/` — done 2026-09-28, five
        slides. The sign-in slide is left out until an iPhone capture of the
        welcome screen (with the Apple button) is put in
        `assets/store/ios-captures/welcome.jpg`. Same-named files in that
        folder replace the shared web screens for the iOS set only.
      The Play set is untouched (regenerated byte-identical).
- [ ] Age rating questionnaire — same answers as the Play content rating
- [ ] Privacy policy URL (the published GitHub Pages one) into the listing

### 8d. Build and verify

**A device is now available** — a borrowed iPhone 11 Pro Max, registered
2026-09-27 for ad-hoc distribution (UDID `00008030-000A78C63680802E`, Apple
Team `RH92B5F87N`). Still worth getting a permanent one (used iPhone, iOS 13+)
for ongoing support and future releases, since this one is borrowed.

- [x] **First `eas build -p ios` failed, as expected — and is now fixed.** Two
      attempts:
      1. `iTunes service key is empty` on `eas device:create` — a stale local
         `eas-cli@18.5.0`; fixed by upgrading to `24.8.0`.
      2. Actual pod install failure, twice: `AppCheckCore` (pulled in
         transitively by `@react-native-google-signin/google-signin`) is a
         Swift pod that can't build as a static library without module maps.
         First attempt used `expo-build-properties`'s `ios.useModularHeaders`
         — **not a real option**, checked its actual schema in
         `node_modules` and it silently did nothing, so the identical error
         reproduced. Fixed for real with `ios.useFrameworks: "static"`.
      Build `1a74461a-761e-40b4-b26f-e65e47c38f6d` succeeded 2026-09-27 —
      first working ad-hoc `.ipa` for this project, installed via the EAS
      install link directly on the registered device (no TestFlight needed
      for internal ad-hoc distribution).
- [x] Installed build **opens** and runs on the device (confirmed by user
      2026-09-28).
- [ ] Repeat §6 on a real device, paying attention to the iOS-only paths:
      Sign in with Apple, the `padding` keyboard behaviour, and the 88pt tab
      bar
- [ ] Purchase a consumable in the TestFlight sandbox and confirm the coins
      arrive; force-quit immediately after one and confirm they still arrive


### 8e. Readiness audit — 2026-09-28

Verdict: **iOS does not depend on Google's payments profile and can ship
first**, but is not yet submittable. What stands between here and "Submit for
Review", in order:

1. **[x] No sound on iOS.** `playsInSilentMode:
   false` + `duckOthers` is rejected by expo-audio's iOS validation; the
   `catch` hid it. Fixed in `soundService.ts`, regression test in
   `__tests__/soundAudioMode.test.ts`. **Not yet confirmed on the device.**
2. **Google Sign-In on iOS: configured 2026-09-28, awaiting a build.**
   The env var and `iosUrlScheme` were both missing/wrong (see §8b); now set.
   Not proven until a new build is installed and the button is tapped. If it
   still fails, hide the button on iOS before submitting (Apple + emailed code
   satisfy guideline 4.8) — App Review will tap it.
3. **Sign in with Apple token revocation on deletion: code written
   2026-09-28, not yet live.** On iOS, Delete account asks Apple to confirm
   afresh (Supabase's native flow keeps no refresh token), and sends the
   one-time code to `delete-account`, which exchanges and revokes it
   (`_shared/appleRevoke.ts`, 7 unit tests). Cancelling Apple's sheet stops the
   deletion; any other Apple failure never blocks it. Remaining:
   - [x] Supabase secrets `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID`
   - [x] Secret `APPLE_PRIVATE_KEY` (the `.p8`, key id `48UU42RHVM`) — set
         2026-09-28; confirmed a valid P-256 key. Keep the `.p8` file safe:
         Apple only lets it be downloaded once.
   - [x] `delete-account` deployed and boots (probed with the anon key)
   - [ ] Needs the new iOS build; then delete an Apple-signed-in test account
         and check **Settings → Apple ID → Sign in with Apple** no longer lists
         Cruxe, and the function logs show no revocation warning.
4. **In-app purchases**: all four consumables are "Missing Metadata" (review
   screenshot + note; see `listing-copy.md`), and must be attached to the
   version. Sandbox purchase is untested, and so is the RevenueCat
   Starter → `com.cruxe.coins.starter2` mapping.
5. **App Privacy labels**: use `app-store-privacy.md`.
6. **Screenshots** at 6.9" (1320×2868 or 1290×2796). `brand:store` is
   hard-coded to 1080×1920; it needs an iPhone size option, or capture real
   screenshots on the device.
7. **A production build** (`eas build -p ios --profile production`) and
   `eas submit`, then TestFlight processing. The ad-hoc build on the phone
   cannot be submitted.
8. **Listing copy, URLs, age rating, review notes**: prepared in
   `listing-copy.md`.
9. Legal pages: reviewed 2026-09-28 against the code; refund clause now names
   both stores and Hide My Email is explained. Landing page shows "iPhone —
   coming soon"; **swap in Apple's official badge and the App Store link once
   the app is live** (the link does not exist before approval).

---

## Known gaps at launch

Deliberate, recorded so they are decisions rather than oversights.

- **No *push* notifications.** Local reminders ship; server-initiated push is
  deferred until there is something only a server could say.
- **No achievements or leagues.** Deferred with the rest of the retention work
  until funnel data shows where players actually leave.
- **Accessibility is partial.** Grid, shared components and primary actions
  are labelled; secondary screens are not, and dynamic type is unsupported
  because every font size is a fixed number. Reduced motion *is* honoured on
  the takeaway screen.
- **Puzzle buffer: turned on, not yet observed.** The quota reason is gone
  (`gemini-3.1-flash-lite`, 500 requests/day against 19 puzzles), and the
  buffer is no longer pending either — `653e776` put `for OFFSET in 0 1 2`
  into the workflow and raised the job timeout to 60 minutes. What is still
  unproven is a *run*: three days of generation is roughly triple the API
  calls and triple the wall time of the single-day job that used to fit in
  30 minutes, and no completed run has been checked. Confirm the next
  scheduled run finished before treating the buffer as real.
- **Clues are not grounded in the live web.** Google Search grounding returns
  429 on a free-tier project regardless of request quota; it needs billing.
  The policy is written and gated behind `GEMINI_GROUNDING`. Until then the
  prompt asks for durable material rather than current events, because a
  model guessing at recent news invents it.
- **No rate limit on feedback.** One account could insert many rows. Acceptable
  pre-launch; the fix is a trigger capping rows per user per hour, not a
  client-side check.
- **An account is required to play.** There is no trial of the real app
  without signing in. The warm-up tutorial now sits *after* sign-in, so a
  visitor cannot try the game before committing to an account. This is a
  product decision, and it is the kind that shows up in install-to-signup
  drop-off rather than in a crash report.

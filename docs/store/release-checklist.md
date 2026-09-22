# Cruxe — store release checklist

Android and iOS are now parallel tracks. The Apple Developer account exists
as of 2026-09-23, so §8 is unblocked and its slow, serial steps (Service ID,
App Store Connect record, TestFlight processing) should be started alongside
the Android work rather than after it.

Ordered by dependency: each section unblocks the next. Items marked
**[blocked]** are waiting on something outside the codebase.

**Last revised:** 2026-09-23 (Apple account, Gemini model swap); 2026-09-21, after confirming §1b live against the Supabase
project directly (REST probes + the public GoTrue settings endpoint, not
just "the migration file exists") and publishing the legal pages.

---

## 1. Account and payments

- [ ] **[blocked]** Play Console → Setup → **Payments profile** verified
      *(submitted 2026-09-02; verification takes days)*
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
- [ ] **Check Supabase CAPTCHA (Authentication → Settings).** Not visible on
      the public settings endpoint, so this still needs a manual look in the
      dashboard. It protects the *signup* endpoint, and both
      `signInWithOtp({ shouldCreateUser: true })` and a first-time
      `signInWithIdToken` are signups — with CAPTCHA on, no new account can
      be created by any method.
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
      24-bit PNG, no alpha. Not yet uploaded to Play Console.
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
- [ ] Category: Games → Word
- [ ] Content rating questionnaire *(expect Everyone. Note there is now
      user-submitted free text — the feedback form — but it is sent only to
      the developer and is never shown to other users, so it is not UGC in
      the sense the questionnaire means.)*
- [ ] Target audience: not directed at children

## 5. Policy and compliance

- [x] Pages written: `web/index.html`, `privacy.html`, `terms.html`,
      `account-deletion.html`
- [x] **Published** — all four routes return 200:
      https://samcladson.github.io/cruxe/privacy.html ·
      /terms.html · /account-deletion.html · /
- [ ] Paste the privacy URL into the listing, and the deletion URL into the
      Data safety form
- [ ] Complete the Data safety form using `docs/store/play-data-safety.md`
      — **re-read it first**, the answers changed materially when accounts
      became mandatory (email is now *required*, not optional) and the
      feedback form was added
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
SHA-1 that Google Sign-In checks against in that build specifically. Treat
the checkboxes below as unverified until run once against the actual
`eas build --profile production` artifact — that build hasn't been made yet
(§2).

**Auth — all new, none of it previously verified:**

- [ ] Cold start with no session lands on **welcome**, not the tabs
- [ ] Google sign-in → tutorial → home, on a fresh install
- [ ] **Email code**: request, receive, enter, land in the app. This is the
      fallback that makes Google non-fatal, so it has to be proven.
- [ ] A wrong or expired code is refused without stranding the screen
- [ ] Sign out returns to welcome; signing back in restores coins and streak
- [ ] Delete account removes the row and the next launch shows welcome
- [ ] Profile → Account & Sync shows the right account identity

**Gameplay:**

- [ ] Tutorial teaches the reverse-direction mechanic and the arrow appears
- [ ] Solve a real puzzle: score and coins arrive from the server
- [ ] Airplane mode solve shows "Pending" and syncs on reconnect
- [ ] Hint with insufficient coins is refused **and reveals nothing**
- [ ] Three free plays, then the fourth charges
- [ ] Daily challenge is free and does not consume a free play
- [ ] **CHECK is disabled until you type a letter of your own** (pre-filled
      letters must not enable it)
- [ ] **Keyboard**: the active row stays visible, and the grid does not draw
      over the title or clue bar
- [ ] **Clue sheet**: the chevron raises it to half screen and it scrolls
- [ ] A solved puzzle in today's collection opens its **result**, not a
      replayable grid
- [ ] Break a streak (set `last_played_date` back two days): the repair
      prompt appears and the first repair each month is free
- [ ] Turning on the daily reminder prompts for permission and fires
- [ ] Sentry receives a release-build crash with breadcrumbs attached
- [ ] **Send feedback** submits successfully — the RLS policy is insert-only,
      and a policy that is too tight fails exactly like a network error
- [ ] TalkBack: the grid is navigable and squares are announced with position
- [ ] **Typing stays on one axis.** Type through an intersection — the
      highlight must not jump. Backspace back through it — same.

## 7. Release

- [ ] Upload to **internal testing** first (`eas submit` is configured for the
      internal track, draft status)
- [ ] Add testers, install from the Play link, repeat §6
- [ ] Promote to production

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
- [ ] **Paid Apps agreement signed, plus tax and banking details.** Until this
      clears, StoreKit returns *no products* and the store looks empty for
      reasons nothing in the app can report. This is the iOS twin of the §1
      Play payments profile, and it is the step most likely to quietly cost a
      week.
- [ ] **iOS OAuth client** in Google Cloud for bundle id `com.cruxe.app`,
      same project as the Android clients. Then:
      - [ ] set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `.env` **and in EAS**
            (`production` + `preview` — see the §2 rule; a var that exists
            only in `.env` is absent from the build)
      - [ ] replace `iosUrlScheme` in `app.json` with the **reversed iOS
            client id**. It currently holds the reversed *web* client id,
            which is not a valid scheme for this and will not work.
- [x] **Apple provider enabled in Supabase** — confirmed live 2026-09-23:
      `GET /auth/v1/settings` reports `external.apple: true`, the same way
      §1b confirmed the others, not just "the toggle looked on."
      **Still unverified: the Client IDs field.** Its contents are not exposed
      on the public settings endpoint, so it needs a manual look. It must hold
      `com.cruxe.app`. If it is empty or wrong, the provider still reports
      `true` here and sign-in fails only on device, with
      `Unacceptable audience in id_token` — an error that names neither
      Supabase nor the field you have to fix.
- [ ] Sign in with Apple in Supabase → Authentication → Providers → Apple:
      put `com.cruxe.app` in **Client IDs**. That is all.
      **No Service ID and no `.p8` secret key** — an earlier draft of this
      line asked for both, which was wrong. Those are for the web OAuth
      redirect flow; `signInWithApple()` uses `signInWithIdToken`, the native
      flow, where Supabase only verifies the token's `aud` against Client IDs.
      The key becomes necessary only if Apple sign-in is ever added to the
      web build or to Android.
- [ ] App Store Connect app record, bundle id `com.cruxe.app`
- [ ] Four consumables in App Store Connect with the **same** product ids as
      Play, so `coin_products` stays four rows rather than eight:
      `com.cruxe.coins.starter` / `.plus` / `.pro` / `.elite`
- [ ] RevenueCat App Store app, products attached to the **same `default`
      offering** as the Play and Test Store products
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (the `appl_…` public key) set in
      the EAS `production` environment
- [ ] Fill the three `TODO_` values in `eas.json` once the ASC record exists

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
- [ ] **Screenshots** — 6.9" iPhone required. The existing six are 1080×1920
      (a 16:9 Android ratio) and are the wrong aspect for iPhone; regenerate
      via `npm run brand:store` at the iPhone size rather than uploading these
      letterboxed. No iPad set needed now that `supportsTablet` is false.
- [ ] Age rating questionnaire — same answers as the Play content rating
- [ ] Privacy policy URL (the published GitHub Pages one) into the listing

### 8d. Build and verify **[blocked on a device]**

**There is no iOS test device.** No iPhone, no Mac, so no simulator either.
Every box in this subsection needs hands on hardware, and none of them can be
signed off without it. This — not the code and not the Apple account — is what
now gates the iOS launch, so it is worth solving early rather than discovering
at submission time. Realistic routes, best first:

1. **A cheap used iPhone.** Anything on iOS 13+ runs Sign in with Apple. This
   is also the only route that helps with *future* releases and with support.
2. **A TestFlight tester who owns one.** Needs the App Store Connect record
   first, and every fix is a new build plus processing plus a round trip
   through someone else's attention. Workable, slow, and poor for debugging.
3. **A rented cloud Mac** (MacinCloud, Scaleway) for a simulator. Fine for
   Apple sign-in and layout, useless for §3-style purchase testing — StoreKit
   does not behave like a real device in the simulator.

A device farm (BrowserStack, AWS Device Farm) looks like the obvious answer
and is not: signing into a real Apple ID on a shared, wiped device is normally
blocked, which is precisely the thing being tested.

**Do this now anyway — it needs no device:** run
`eas build -p ios --profile production`. An App Store build requires no
registered UDID, and running it early pays for itself three times: it makes
EAS provision credentials and create the App ID with the Sign in with Apple
capability (§8b), it flushes out the first-time native build failures below
while there is no deadline, and it leaves an `.ipa` ready for TestFlight the
moment a device appears.

- [ ] **First `eas build -p ios` will probably fail once or twice.** iOS has
      never been built here — `/ios` is git-ignored and prebuild has not run
      for it, so no native iOS issue has ever surfaced. `react-native-worklets`
      / Reanimated 4 and `lottie-react-native` are the usual suspects. Budget
      for it; this is not a sign anything is wrong.
- [ ] TestFlight build installs and **opens** — the Android lesson (version
      code 4 opened to a crash because an env var was missing from EAS)
      applies here unchanged
- [ ] Repeat §6 on a real device, paying attention to the iOS-only paths:
      Sign in with Apple, the `padding` keyboard behaviour, and the 88pt tab
      bar
- [ ] Purchase a consumable in the TestFlight sandbox and confirm the coins
      arrive; force-quit immediately after one and confirm they still arrive

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

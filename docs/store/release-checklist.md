# Cruxe — store release checklist

Android is the near-term target. An Apple Developer account is being obtained,
so iOS is no longer out of scope — the app code is ready for it (see §8), but
nothing iOS can be verified until the account exists.

Ordered by dependency: each section unblocks the next. Items marked
**[blocked]** are waiting on something outside the codebase.

**Last revised:** 2026-09-20, after guest-account removal, the email sign-in
fallback, the feedback form, and the RevenueCat Test Store work.

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
- [ ] **Apply migration 019** — deletes anonymous accounts. Destructive and
      deliberate: guest play is gone, so those rows are unreachable.
- [ ] **Apply migration 020** — the `feedback` table.
      *(Probing the live project returns `42501 permission denied` for
      `feedback`, which means the table already exists with SELECT revoked —
      i.e. it looks applied. Confirm before assuming.)*
- [ ] **Supabase → Authentication → Providers → disable "Allow anonymous
      sign-ins".** The app no longer calls it, but leaving it on keeps the
      endpoint open.
- [ ] **Supabase → Authentication → Providers → enable Email.** The emailed
      six-digit code is the only sign-in that does not depend on Google or
      Apple. Without it, Android has exactly one door.
- [ ] **Check Supabase CAPTCHA (Authentication → Settings).** It protects the
      *signup* endpoint, and both `signInWithOtp({ shouldCreateUser: true })`
      and a first-time `signInWithIdToken` are signups. With CAPTCHA on, no
      new account can be created by any method. The old note said this broke
      anonymous sign-in; anonymous auth is gone, but the constraint moved
      rather than disappeared.
- [ ] **Resolve Google Sign-In.** Still failing with
      `invalid claim: missing sub claim`. This is now the single highest
      release risk: with guest play removed, a broken Google provider on
      Android means new users cannot get in at all unless email OTP is live.
      Check `aud` matches the web client id, and that Supabase →
      Authentication → Providers → Google lists it under Authorized Client IDs.
- [ ] Re-run `npx jest __tests__/integration` against the post-019 schema

## 2. Build

- [x] `eas.json` production profile: app-bundle, `autoIncrement`
- [x] `app.json`: `versionCode`, dark splash and adaptive-icon backgrounds
- [x] `RECORD_AUDIO` blocked — `expo-av` declares it, the app never records
- [x] `EXPO_PUBLIC_SENTRY_DSN` present in the EAS build environment
- [x] `SENTRY_AUTH_TOKEN` set as an EAS **secret**
- [ ] **Confirm the EAS `production` environment holds real RevenueCat keys.**
      `.env` currently carries a `test_…` Test Store key for both platforms,
      and RevenueCat is explicit that a build configured with one must never
      be submitted. This is the failure mode where a shipped app cannot sell
      anything.
- [ ] `npx eas build --platform android --profile production` succeeds
- [ ] **Register the release SHA-1 with Google.** Debug and EAS release builds
      are signed with different keys; Google Sign-In fails with
      `DEVELOPER_ERROR` for any unregistered package + SHA-1 pair. Get it via
      `npx eas credentials` (Android → keystore), and add the Play App
      Signing SHA-1 from Setup → App integrity too.
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
- [ ] Import them into a RevenueCat Offering built on the **Play** app, not
      the Test Store, and make it Current
- [ ] Swap the app to the production RevenueCat key and repeat the purchase
- [ ] Force-quit immediately after a purchase and confirm the coins still
      arrive — this is what the webhook exists to guarantee
- [ ] Confirm **Restore Purchases** credits a dropped webhook
      (`sync-purchases` needs `REVENUECAT_SECRET_API_KEY`, the `sk_…` key)

## 4. Store listing

- [x] App name, short description, full description, "what's new"
      — in `docs/store/listing-copy.md`, paste-ready
- [ ] **Feature graphic** 1024×500
- [ ] **Screenshots** — at least 2, phone. Worth capturing: the daily
      challenge card, a partly-solved grid, the takeaway screen, the
      leaderboard
- [ ] App icon 512×512
- [ ] Category: Games → Word
- [ ] Content rating questionnaire *(expect Everyone. Note there is now
      user-submitted free text — the feedback form — but it is sent only to
      the developer and is never shown to other users, so it is not UGC in
      the sense the questionnaire means.)*
- [ ] Target audience: not directed at children

## 5. Policy and compliance

- [x] Pages written: `web/index.html`, `privacy.html`, `terms.html`,
      `account-deletion.html`
- [ ] **Publish them.** GitHub → Settings → Pages → Source → **GitHub
      Actions**. The `Publish legal pages` workflow serves `web/` and prints
      the URLs in its run summary.
- [ ] Paste the privacy URL into the listing, and the deletion URL into the
      Data safety form
- [ ] Complete the Data safety form using `docs/store/play-data-safety.md`
      — **re-read it first**, the answers changed materially when accounts
      became mandatory (email is now *required*, not optional) and the
      feedback form was added
- [ ] **Update the hosted `web/privacy.html` and `web/terms.html`** to match
      `app/legal/privacy.tsx` and `app/legal/terms.tsx`. The in-app terms were
      rewritten when guest play was removed; the hosted copies still describe
      anonymous accounts that can lose their progress.
- [ ] Confirm both name the same processors: Supabase, RevenueCat,
      Google/Apple Sign-In, Sentry
- [ ] Ads declaration: **contains no ads** — IAP-only by decision

## 6. Pre-launch verification

Run against a real build, not the dev client.

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

## 8. iOS **[blocked on an Apple Developer account]**

The app code is ready; none of this is app work.

- [x] `expo-apple-authentication` installed, `usesAppleSignIn: true`
- [x] `signInWithApple()` implemented with SHA-256 nonce replay protection and
      first-authorisation name capture, gated to `Platform.OS === "ios"`
- [ ] Apple Developer Program membership
- [ ] Sign in with Apple: Service ID + key, configured in Supabase →
      Authentication → Providers → Apple
- [ ] App Store Connect app record, bundle id `com.cruxe.app`
- [ ] Four consumables in App Store Connect with the **same** product ids as
      Play, so `coin_products` stays four rows rather than eight
- [ ] RevenueCat App Store app + offering
- [ ] iOS build, TestFlight, repeat §6 on device

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
- **No puzzle buffer.** The Gemini free tier allows 20 requests/day against 19
  puzzles, so generating days ahead is impossible without a paid tier. A
  failed run fails loudly, but the day is still thin until re-run.
- **No rate limit on feedback.** One account could insert many rows. Acceptable
  pre-launch; the fix is a trigger capping rows per user per hour, not a
  client-side check.
- **An account is required to play.** There is no trial of the real app
  without signing in. The warm-up tutorial now sits *after* sign-in, so a
  visitor cannot try the game before committing to an account. This is a
  product decision, and it is the kind that shows up in install-to-signup
  drop-off rather than in a crash report.

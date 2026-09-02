# Cruxe — Play Store release checklist

Android only. There is no Apple Developer account, so iOS is out of scope
until one exists.

Ordered by dependency: each section unblocks the next. Items marked
**[blocked]** are waiting on something outside the codebase.

---

## 1. Account and payments

- [ ] **[blocked]** Play Console → Setup → **Payments profile** verified
      *(submitted 2026-09-02; verification takes days)*
- [ ] Developer account details complete (name, address, contact email)

Nothing below section 3 can be finished until the payments profile clears,
because in-app products cannot be created without it.

## 1b. Outstanding engineering

- [ ] **Disable Supabase CAPTCHA** (Authentication → Settings). It blocks
      anonymous sign-in, which breaks sign-out, account deletion, and every
      fresh install. Incompatible with anonymous-first auth.
- [ ] **Run migrations 014 then 015**, in that order — Postgres refuses to
      use a new enum value in the transaction that adds it. Until then streak
      repair is inert (the app degrades quietly, by design).
- [ ] **Resolve Google Sign-In.** Currently failing with
      `invalid claim: missing sub claim` — the app now logs the token's shape,
      `iss` and `aud` on failure. Check that `aud` matches the web client id
      in use, and that Supabase → Authentication → Providers → Google is
      enabled with that id under Authorized Client IDs.
- [ ] Re-run `npx jest __tests__/integration` after 014/015 (40 tests, plus
      any added for streak repair)

## 2. Build

- [x] `eas.json` production profile: app-bundle, `autoIncrement`
- [x] `app.json`: `versionCode`, dark splash and adaptive-icon backgrounds
- [x] `RECORD_AUDIO` blocked — `expo-av` declares it, the app never records
- [ ] `EXPO_PUBLIC_SENTRY_DSN` present in the EAS build environment
- [ ] `SENTRY_AUTH_TOKEN` set as an EAS **secret** (not in `.env` — it is a
      write credential) so sourcemaps upload and stack traces are readable
- [ ] `npx eas build --platform android --profile production` succeeds
- [ ] **Register the release SHA-1 with Google.** Local debug builds and EAS
      release builds are signed with *different* keys. Google Sign-In fails
      with `DEVELOPER_ERROR` for any package + SHA-1 pair that is not
      registered, so the release key needs its own Android OAuth client.
      Get it with `npx eas credentials` (Android → keystore), and if Play App
      Signing is enabled, also add the SHA-1 Play shows under
      Setup → App integrity.
- [ ] Install the resulting AAB/APK and complete a full run-through
      (see section 6)

## 3. In-app products **[blocked on §1]**

- [ ] Create four consumables in Play Console with these **exact** IDs —
      they must match `coin_products`, and an unknown SKU is rejected by
      `credit_purchase` rather than guessed at:
      - `com.cruxe.coins.starter` — $0.99
      - `com.cruxe.coins.plus` — $4.99
      - `com.cruxe.coins.pro` — $9.99
      - `com.cruxe.coins.elite` — $19.99
- [ ] **Activate** each one. New products default to inactive, and an inactive
      product returns nothing to the app — this is the most common cause of
      "the store is empty" on Android.
- [ ] Import them into a RevenueCat Offering
- [ ] Point the RevenueCat webhook at
      `https://mgcuhtqqgdygdfvoirwk.supabase.co/functions/v1/revenuecat-webhook`
      with the shared secret set in `REVENUECAT_WEBHOOK_SECRET`
- [ ] Sandbox purchase end-to-end; confirm exactly one `coin_ledger` row
- [ ] Force-quit immediately after a sandbox purchase and confirm the coins
      still arrive — this is what the webhook exists to guarantee

## 4. Store listing

- [x] App name, short description, full description, "what's new"
      — all written in `docs/store/listing-copy.md`, paste-ready
- [ ] **Feature graphic** 1024×500
- [ ] **Screenshots** — at least 2, phone. Worth capturing: the daily
      challenge card, a partly-solved grid, the results screen with a grade,
      the leaderboard
- [ ] App icon 512×512
- [ ] Category: Games → Word
- [ ] Content rating questionnaire *(expect Everyone; there is no UGC beyond
      display names, which are validated and profanity-filtered server-side)*
- [ ] Target audience: not directed at children

## 5. Policy and compliance

- [x] Pages written: `web/index.html`, `privacy.html`, `terms.html`,
      `account-deletion.html`
- [ ] **Publish them.** GitHub → repo → Settings → Pages → Source →
      **GitHub Actions** (not "Deploy from a branch" — that only offers root
      or /docs, and /docs holds design specs that should not be public).
      The `Publish legal pages` workflow then serves `web/` on every change
      and prints the exact URLs in its run summary.
- [ ] Paste the privacy URL into the store listing, and the deletion URL
      into the Data safety form
- [ ] Complete the Data safety form using `docs/store/play-data-safety.md`
- [ ] Confirm the hosted privacy policy and `app/legal/privacy.tsx` name the
      same processors: Supabase, RevenueCat, Google/Apple Sign-In, Sentry
- [ ] Ads declaration: **contains no ads** — the app is IAP-only by decision

## 6. Pre-launch verification

Run against a real build, not the dev client.

- [ ] First run: welcome → tutorial → celebration → home
- [ ] Tutorial teaches the reverse-direction mechanic and the arrow appears
- [ ] Solve a real puzzle: score and coins arrive from the server
- [ ] Airplane mode solve shows "Pending" and syncs on reconnect
- [ ] Hint with insufficient coins is refused **and reveals nothing**
- [ ] Three free plays, then the fourth charges
- [ ] Daily challenge is free and does not consume a free play
- [ ] Delete account removes the row, cancels notifications, and the next
      launch shows welcome → tutorial as a fresh install
- [ ] Sentry receives a release-build crash with breadcrumbs attached
- [ ] Turning on the daily reminder prompts for permission and fires
- [ ] Break a streak (set `last_played_date` back two days), confirm the
      repair prompt appears and the first repair each month is free
- [ ] TalkBack: the grid is navigable and squares are announced with position
- [ ] **Typing stays on one axis.** Type through an intersection — the
      highlight must not jump to the crossing word. Backspace back through it
      — same. Finishing a word hands off to the next clue.
- [ ] Google Sign-In links an account without losing anonymous progress

## 7. Release

- [ ] Upload to **internal testing** first (`eas submit` is configured for
      the internal track, draft status)
- [ ] Add testers, install from the Play link, repeat section 6
- [ ] Promote to production

---

## Known gaps at launch

Deliberate, recorded so they are decisions rather than oversights.

- **No *push* notifications.** Local reminders (daily, and a streak warning)
  ship; server-initiated push is deferred until there is something only a
  server could say — a friend passing you, a league ending. Neither exists.
- **No achievements or leagues.** Deferred with the rest of the retention
  work until funnel data shows where players actually leave.
- **Accessibility is partial.** Grid, shared components, and primary actions
  are labelled; secondary screens are not, and dynamic type is unsupported
  because every font size is a fixed number.
- **No puzzle buffer.** The Gemini free tier allows 20 requests/day against
  19 puzzles, so generating days ahead is impossible without a paid tier or
  fewer puzzles per day. A failed run now fails loudly rather than silently,
  but the day is still thin until it is re-run.
- **iOS unbuilt.** No Apple Developer account.

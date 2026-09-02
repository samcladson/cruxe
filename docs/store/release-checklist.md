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

## 2. Build

- [x] `eas.json` production profile: app-bundle, `autoIncrement`
- [x] `app.json`: `versionCode`, dark splash and adaptive-icon backgrounds
- [x] `RECORD_AUDIO` blocked — `expo-av` declares it, the app never records
- [ ] `EXPO_PUBLIC_SENTRY_DSN` present in the EAS build environment
- [ ] `SENTRY_AUTH_TOKEN` set as an EAS **secret** (not in `.env` — it is a
      write credential) so sourcemaps upload and stack traces are readable
- [ ] `npx eas build --platform android --profile production` succeeds
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

- [ ] App name, short description (80 chars), full description (4000)
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

- [ ] Host `web/account-deletion.html` at a public URL
      *(GitHub Pages is fine; Play requires a deletion route reachable from
      outside the app)*
- [ ] Host a privacy policy at a public URL and add it to the listing
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
- [ ] Delete account removes the row and returns to sign-in
- [ ] Sentry receives a release-build crash with breadcrumbs attached
- [ ] TalkBack: the grid is navigable and squares are announced with position

## 7. Release

- [ ] Upload to **internal testing** first (`eas submit` is configured for
      the internal track, draft status)
- [ ] Add testers, install from the Play link, repeat section 6
- [ ] Promote to production

---

## Known gaps at launch

Deliberate, recorded so they are decisions rather than oversights.

- **No push notifications.** Deferred with the rest of the retention work
  until there are users to retain and funnel data showing where they leave.
- **No streak repair.** The daily bonus curve is steep — day 14 pays 150 and
  one missed day drops it to 30. Repair is the first thing to build after
  launch.
- **Accessibility is partial.** Grid, shared components, and primary actions
  are labelled; secondary screens are not, and dynamic type is unsupported
  because every font size is a fixed number.
- **No puzzle buffer.** The Gemini free tier allows 20 requests/day against
  19 puzzles, so generating days ahead is impossible without a paid tier or
  fewer puzzles per day. A failed run now fails loudly rather than silently,
  but the day is still thin until it is re-run.
- **iOS unbuilt.** No Apple Developer account.

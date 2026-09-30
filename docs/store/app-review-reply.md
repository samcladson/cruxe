# App Review reply — Guideline 2.1 "Information Needed" (2026-09-30)

Apple's first review of 1.0.0 (build 4) came back as **Information Needed**, not
a bug rejection: a new developer account gets extra scrutiny and Apple wants a
screen recording plus seven written answers. **No new build is needed.** Reply
in App Store Connect → App Review → the message, **and** paste the same text
into App Review Information → Notes (Apple asks for both), then resubmit.

## 1. Screen recording — the user records this on the iPhone

Screen Recording (Control Centre), on the physical iPhone, starting from a cold
launch of the app. Keep it to 2–3 minutes. Show, in order:

1. Launch the app (splash → welcome).
2. **Sign in with Apple** → the Home screen.
3. The warm-up tutorial (first launch only) or Home → Daily Challenge → play a
   few letters, use one hint, then leave the puzzle.
4. **Store tab** → the four coin packs with prices → tap one, show the Apple
   purchase sheet, then cancel it (or complete it in the sandbox).
5. **Profile tab** → Send feedback (the only place a player types free text)
   → **Delete account** → confirm → back at the welcome screen.
6. Optionally sign in again to show a fresh account is created.

Upload it where Apple's message allows (attach in the reply), or share an
unlisted link. Do the deletion **last** — it removes the account.

## 2–7. Text to paste (reply and Notes field)

```
1. Screen recording: attached. It starts from launching the app on a physical
   iPhone and shows sign-in with Apple, solving a puzzle, the Store and
   purchase sheet, sending feedback, and deleting the account.

2. Purpose and audience: Cruxe is a daily crossword game for adults and teens
   who like word puzzles and brain games. A fresh set of puzzles (19 a day
   across five categories, with a Daily Challenge) is published every day.
   Its twist is that some clues read backwards or upwards, and a short
   takeaway after each puzzle links its answers together. Players earn coins by
   solving and spend them on hints. It is a solo game for short daily sessions.

3. Access: an account is required to play. There is no password login, so no
   demo account exists. On the welcome screen tap "Continue with Apple" and use
   the Apple ID already signed in on the review device; a new account is
   created instantly with no email verification. New accounts receive 300
   coins and 5 free puzzle plays a day. Main features: Home tab (Daily
   Challenge), Collection tab (today's puzzles, filter by difficulty and grid
   size), Store tab (coins), Leaderboard tab, Profile tab (stats, settings,
   Send feedback, Sign out, Delete account).

4. External services: Supabase (authentication, database, server functions);
   Sign in with Apple, plus Google Sign-In and an emailed one-time code as
   alternatives; RevenueCat (in-app purchase handling and receipt validation);
   Google Gemini (generates the puzzle word lists on our servers ahead of time
   — no AI is run on the device and players never enter prompts); Sentry (crash
   reports). No ads, no advertising or tracking SDKs, no App Tracking
   Transparency prompt.

5. Regional differences: none. The app, its content and its purchases work the
   same in every region where it is available. It is not offered in mainland
   China or Vietnam because we hold no local licences.

6. Regulated industry / third-party material: not applicable. Cruxe is not in a
   regulated industry. All puzzles, clues and text are original or generated
   for the app; there is no protected third-party content.

7. In-App Purchases: four consumable coin packs — Starter ($0.99, 300 coins),
   Plus ($4.99, 1,800), Pro ($9.99, 3,900), Elite ($19.99, 9,000). Coins
   unlock hints and extra puzzle plays beyond the free daily allowance. They
   are optional: coins are also earned by solving. There is no gambling or
   chance-based reward, and no subscription. To reach the purchase flow: sign
   in, tap the Store tab, choose a pack. Purchases can be restored from the
   Store tab.

User-generated content: none is shown to other players. The only free text is
the Send feedback form (Profile tab), which goes to the developer only. The
leaderboard shows display names and scores; there is no chat, comments,
messaging or profile content, so no reporting or blocking is needed. Account
deletion: Profile tab → Delete account; it removes the account and revokes the
Sign in with Apple token.
```

## Before sending, verify

- **Purchase names and prices** above match App Store Connect (the checklist's
  table is the source: `com.cruxe.coins.starter2` / `plus` / `pro` / `elite`).
- **Restore Purchases** exists on the Store tab (verified in store.tsx).
- Whether the leaderboard shows names is a fact about the app; if it ever shows
  anything a player types beyond their display name, the UGC line changes.

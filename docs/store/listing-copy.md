# Play Store listing copy

Paste-ready. Character limits are Google's and are enforced at submission.

---

## App name (30 max)

```
Cruxe: Daily Crossword
```

Plain "Cruxe" tells a browsing user nothing. The subtitle is what makes it
findable — "crossword" is the search term people actually type.

---

## Short description (80 max)

```
A new set of crosswords every day. Beautifully made, properly hard.
```

*67 characters.* This is the line shown in search results and is the only copy
most people read. It leads with the daily habit and closes on difficulty,
because "properly hard" self-selects the audience who will stay. It says
"crosswords", not "handcrafted": the puzzles are generated with Gemini, and
Play's metadata policy penalizes claims that misdescribe the app.

---

## Full description (4000 max)

```
A fresh set of crosswords, every single day.

Cruxe is built for people who actually like the puzzle — clean grids, clues
with a bit of bite, and no clutter between you and the next answer.

━━━ A NEW SET DAILY ━━━

Every day brings a new Daily Challenge plus a full collection across five
categories: General, History, Technology, Entertainment and Sports. Four
difficulty tiers, from a gentle 6×6 to a properly demanding 12×12.

━━━ SOMETHING DIFFERENT ━━━

Cruxe grids aren't only across and down. Some answers read backwards or
upwards — a small twist that makes a familiar format feel new again. The app
shows you an arrow so you always know which way a clue runs.

━━━ PLAY FREE, EVERY DAY ━━━

The Daily Challenge is always free, and so are five more puzzles a day. No
timer counting down, no lives to wait for. Play your set, come back tomorrow.

Want more in one sitting? Coins let you keep going.

━━━ HINTS WHEN YOU'RE STUCK ━━━

Reveal a single letter, uncover a whole word, or check your grid for mistakes.
Hints cost coins, which you earn simply by solving — nobody has to pay to
finish a puzzle.

━━━ BUILD A STREAK ━━━

Solve daily and your streak grows, and so does your daily bonus. Miss a day?
You can restore your streak — free once a month.

━━━ COMPETE ━━━

Every solve is scored on difficulty, speed and how few hints you needed, then
graded S to D. Climb the global leaderboard.

━━━ NO ADS. EVER. ━━━

Cruxe has no advertising. Not between puzzles, not for rewards, not anywhere.
Coin packs are entirely optional.

━━━

Play offline. Your progress syncs when you reconnect.

Questions or feedback: samcladson08@gmail.com
```

---

## What's new (500 max) — first release

```
The first release of Cruxe.

A new set of crosswords every day, a Daily Challenge that's always free, and
grids where some answers read backwards. No ads.
```

---

## Notes on claims

Every claim above is true of the shipped app. Worth keeping honest as things
change:

- **"No ads. Ever."** — reflects a deliberate decision recorded in the
  sub-project 2 spec. If rewarded video is ever added, this copy and the Data
  Safety declaration both have to change.
- **"five more puzzles a day"** — `economy_config.free_plays.per_day` is 5.
  If that is retuned, update this line.
- **"free once a month"** — `economy_config.streak.free_repairs_per_month`.
- **"Play offline"** — solving works offline; the reward syncs on reconnect
  and the app says so plainly rather than implying instant credit.

---
---

# Apple App Store listing copy

Paste-ready for App Store Connect → the app → iOS App → the version's page.
Limits are Apple's. Same honesty rules as above: the puzzles are AI-generated,
so nothing here says "handcrafted".

## Name (30 max)

```
Cruxe: Daily Crossword
```

*22 characters.* Names are unique across the whole App Store; if Apple says
it is taken, fall back to `Cruxe Crossword`.

## Subtitle (30 max)

```
A new crossword every day
```

*25 characters.* Shown under the name in search results.

## Promotional text (170 max)

```
A new Daily Challenge every day, always free. Grids where some answers read backwards or upwards. No ads.
```

*105 characters.* Editable at any time without a new review, so this is the
place for anything time-sensitive later.

## Keywords (100 max, comma-separated, no spaces after commas)

```
crossword,puzzle,word game,daily,brain,clues,trivia,grid,streak,leaderboard
```

*75 characters.* Do not repeat the app name (Apple already indexes it).
Deliberately no "cryptic": these are not cryptic crosswords, and a mismatched
keyword is a metadata-rejection risk.

## Description (4000 max)

Apple shows plain text, so the section rules from the Play copy become short
headings. Use the Play full description with these two changes: replace the
`━━━ … ━━━` banners with a plain heading line, and keep "Questions or
feedback" as the last line.

## What's new

Same as the Play "first release" text above.

## URLs

| Field | Value |
|---|---|
| Support URL | `https://samcladson.github.io/cruxe/` |
| Marketing URL (optional) | `https://samcladson.github.io/cruxe/` |
| Privacy Policy URL | `https://samcladson.github.io/cruxe/privacy.html` |

Apple requires a Support URL that loads a real page; the landing page counts
and carries the contact address in its footer.

## Category and rating

- Primary category: **Games → Word**. Secondary: optional; leave empty.
- Age rating: answer the questionnaire the same way as Play's content rating
  (no violence, no gambling, no user-generated content shown to others, no
  web access). Cruxe has **no gambling** — coins buy puzzles and hints, not
  chance-based rewards.
- Not made for kids; do not enrol in the Kids category.

## App Review Information

**Sign-in required:** tick it, but leave the username and password blank, and
paste this into the notes field verbatim:

```
No demo account is required. On the welcome screen, tap Sign in with Apple and
use the reviewer Apple ID already signed in on the device. Google sign-in and
an emailed one-time code are alternatives.

Coin packs are consumable in-app purchases (Store tab). Puzzles are generated
centrally with AI before anyone plays them and are labelled as such in the
Terms of Service.
```

Contact: the developer email and a phone number (Apple requires one; it is
not shown publicly).

## In-app purchase metadata (all four are in "Missing Metadata")

Each of the four consumables needs, before it can leave "Missing Metadata":

- **Display name** and **description** (already entered when created)
- **Review screenshot** — one screenshot of the Store screen, reused for all
  four. It is for App Review only and is never shown to customers. It must be
  a real iPhone screenshot of the Store screen with prices showing, so take it
  on the device.
- **Review note:** `Consumable pack of coins, used to unlock extra puzzles and
  hints.`

Then attach all four to the app version under **In-App Purchases and
Subscriptions** on the version page, or they will not be submitted with it.

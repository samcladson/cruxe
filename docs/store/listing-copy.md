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
A new set of handcrafted crosswords every day. Beautifully made, properly hard.
```

*78 characters.* This is the line shown in search results and is the only copy
most people read. It leads with the daily habit and closes on difficulty,
because "properly hard" self-selects the audience who will stay.

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

The Daily Challenge is always free, and so are three more puzzles a day. No
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
- **"three more puzzles a day"** — `economy_config.free_plays.per_day` is 3.
  If that is retuned, update this line.
- **"free once a month"** — `economy_config.streak.free_repairs_per_month`.
- **"Play offline"** — solving works offline; the reward syncs on reconnect
  and the app says so plainly rather than implying instant credit.

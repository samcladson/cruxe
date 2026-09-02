# Cruxe — Economy & Difficulty Rebalance

**Date:** 2026-09-02
**Status:** Approved design, ready for implementation planning
**Sub-project:** 2 of 6 (see "Programme context")
**Depends on:** `2026-08-15-economy-integrity-design.md` (server-authoritative economy)

---

## 1. Problem

The current economy cannot support a business, and is simultaneously hostile
to players who need help.

**Every puzzle is net-positive.** Solve rewards exceed entry fees at every
difficulty:

| | Easy | Medium | Hard | Expert |
|---|---|---|---|---|
| Entry fee | 5 | 15 | 30 | 60 |
| Solve reward | 10 | 25 | 50 | 100 |
| **Net** | **+5** | **+10** | **+20** | **+40** |

A patient player's balance therefore only ever grows, before the 15–50/day
login bonus is even counted. There is no state in which a player needs to buy
coins, so the store sells nothing.

**Hints are priced as a wall, not a price.** Reveal-word costs 30 per
unrevealed letter, so an 8-letter answer is 240 coins and a 12-letter expert
answer is 360 — roughly ten and fourteen medium puzzles. Nobody pays that.
Players hoard coins, never experience a hint's value, and quit when stuck.

**The daily puzzle is behind an entry fee.** Charging to play the daily is the
most retention-hostile choice in the design. Comparable games (NYT Games,
Wordle, Wordscapes) all keep the core daily free.

**Streaks stop mattering after a week.** The daily bonus caps at 50 coins on
day 7 and never grows again, discarding the strongest retention lever the game
has.

## 2. Goals

- A player's balance falls when they play beyond a free daily allowance, so a
  reason to purchase exists.
- No player is ever charged to play the daily challenge.
- Hints are cheap enough that free players actually use them.
- Streak length remains economically meaningful past two weeks.
- No client-supplied value affects any price, completing sub-project 1's
  security goal.

## 3. Non-goals

- **Rewarded video ads.** Explicitly rejected: Cruxe is positioned as a premium
  product and will monetise through IAP only. This constrains the design — with
  no ad valve, the free tier must be comfortable enough that a non-paying
  player stays rather than churns.
- **Push notifications, streak freeze/repair, achievements, leagues**
  (sub-project 3). The streak cliff this design creates is accepted here and
  addressed there.
- **Onboarding, tutorial, and the visual design of the out-of-plays screen**
  (sub-project 4). This spec fixes *when* a player reaches that state, not what
  it looks like.
- **A second currency.** One legible currency is worth more than the
  flexibility.
- **First-purchase bonus** and other store conversion levers.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Free daily allowance with paid overflow; hints always paid | Protects D1 retention — nobody is charged to start — while creating a real sink among engaged players, who are the only realistic buyers. |
| D2 | Allowance = daily challenge (always free, outside the count) + 3 category puzzles | Four solves is a satisfying casual session; engaged players hit the gate most days. |
| D3 | Allowance resets at UTC midnight; no timed regeneration | Matches existing UTC puzzle dating and daily-bonus logic. One mental model: "come back tomorrow." Avoids timer state and a rationed feel. |
| D4 | Overflow entry = 2× solve reward | Makes total daily plays difficulty-independent (~8 for anyone who spends everything), so no difficulty becomes a coin farm and none needs nerfing later. |
| D5 | Reveal-word becomes a flat 120, replacing 30 × letters | Removes the 240–360 cliff, and eliminates `p_letter_count` — the last client-supplied quantity in the economy. |
| D6 | Daily bonus: base 20, +10/streak day, cap 150 | Streaks stay economically meaningful to day 13 instead of day 7. |
| D7 | Welcome bonus 200 → 300 | Enough for ten letter-reveals, so a new player can learn that hints work before they are stuck. |
| D8 | Re-entering an already-started puzzle is always free | A player must never be punished for closing the app mid-solve. |
| D9 | Solve rewards, letter-hint price, and free error-checks unchanged | Limits the blast radius; these values are not the problem. |

---

## 5. The numbers

All values live in `economy_config` and are changeable without an app release.

### 5.1 Play economy

| | Easy | Medium | Hard | Expert |
|---|---|---|---|---|
| Solve reward (unchanged) | 10 | 25 | 50 | 100 |
| Overflow entry (new) | 20 | 50 | 100 | 200 |
| Net when paying to play | −10 | −25 | −50 | −100 |

Free plays earn the full solve reward and cost nothing.

**Free allowance:** 3 category puzzles per UTC day, plus the daily challenge,
which is always free and does not consume a slot.

### 5.2 Hints

| Hint | Old | New |
|---|---|---|
| Reveal letter | 30 | 30 (unchanged) |
| Reveal word | 30 × unrevealed letters | **120 flat** |
| Check errors | 5 free per puzzle, then 20 | unchanged |

At 30 per letter and 120 per word the player has a real choice with a
situationally correct answer: three letter-reveals (90) beat the word price on
a 3-letter answer, while the word price halves the cost on an 8-letter answer.
No pricing by length is needed — it self-balances.

Free error-checks are **per puzzle**, not per day.

### 5.3 Daily bonus

`bonus = min(150, 20 + 10 × current_streak)`

| Day | Streak | Bonus |
|---|---|---|
| 1 | 0 | 20 |
| 3 | 2 | 40 |
| 7 | 6 | 80 |
| 13 | 12 | 140 |
| 14+ | 13+ | 150 |

The bonus is claimed by opening the app; the streak advances only on a solve.
That split is retained: opening is a low-friction return trigger, solving is
what deserves reward.

### 5.4 Welcome bonus

300 coins (was 200).

### 5.5 Resulting daily economics

| Player | Solve income | Bonus | Total/day |
|---|---|---|---|
| New (streak 0, medium) | 100 | 20 | 120 |
| Committed (streak 13+, medium) | 100 | 150 | 250 |
| Committed (streak 13+, expert) | 325 | 150 | 475 |

The daily challenge is always medium, so even an expert player earns 25 for it.
Any player who spends everything reaches roughly **7-8 puzzles/day** out of the
19 available, regardless of preferred difficulty. The remaining 11 are the
sink.

---

## 6. Data model

### 6.1 New table

Tracking free-play consumption needs a record of every entry, including free
ones, which the ledger cannot provide because free plays move no money.

```sql
CREATE TABLE puzzle_entries (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id  UUID NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,          -- UTC date the entry was granted
  cost       INT  NOT NULL,          -- 0 for free plays and daily challenge
  was_free   BOOLEAN NOT NULL,       -- consumed an allowance slot
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, puzzle_id)
);
CREATE INDEX idx_entries_user_date ON puzzle_entries (user_id, entry_date);
```

The primary key gives D8 for free: a second entry for the same puzzle is a
no-op returning the original terms.

Free plays used today is
`COUNT(*) WHERE user_id = ? AND entry_date = today AND was_free`.

RLS: own-row `SELECT` only, no client writes.

### 6.2 New `economy_config` keys

- `free_plays` — `{"per_day": 3, "daily_challenge_free": true}`
- `overflow_fees` — `{"easy": 20, "medium": 50, "hard": 100, "expert": 200}`
- `streak` — `{}`, a placeholder so sub-project 3 can add `freeze_cost` and
  `grace_days` without restructuring

### 6.3 Changed `economy_config` values

- `welcome_bonus.coins`: 200 → 300
- `daily_bonus`: `{"base": 20, "per_streak_day": 10, "cap": 150}`
- `hint_prices.reveal_word_flat`: 120, replacing `reveal_word_per_letter`
- `entry_fees` is **removed**, replaced by `overflow_fees`

---

## 7. Server changes

### 7.1 `pay_entry_fee` becomes `enter_puzzle`

Renamed because it no longer always charges.

```
enter_puzzle(p_puzzle_id UUID) RETURNS JSONB
  -> { cost, was_free, balance, free_plays_remaining, replayed }
```

Logic, in one transaction:

1. Resolve `auth.uid()`; reject if null.
2. If a `puzzle_entries` row already exists for (user, puzzle), return it
   unchanged with `replayed = true`. **Re-entry is always free.**
3. Load the puzzle. If `is_daily_challenge`, record cost 0 with
   `was_free = false` — it does not consume a slot — and return.
4. Count free plays used today. If below `free_plays.per_day`, record cost 0
   with `was_free = true` and return.
5. Otherwise read `overflow_fees[difficulty]`, call `ledger_apply` with key
   `entry:{user}:{puzzle}`, record the cost, and return.

`insufficient_coins` propagates unchanged from `ledger_apply`.

### 7.2 `spend_on_hint`

- The `p_letter_count` parameter is **dropped** from the signature.
- `reveal_word` charges `hint_prices.reveal_word_flat`.
- `hint_events.letters_revealed` is still written, because `submit-solve`
  derives the hint penalty from it. The server cannot know which clue a word
  reveal uncovered, and asking the client would reintroduce the exposure this
  change exists to close — a tampered client would always name the shortest
  clue. So a word reveal is recorded as a fixed
  `reveal_word_flat / reveal_letter` letters (120 / 30 = 4): you are penalised
  exactly the number of letters you paid for. Deriving it from the two prices
  keeps the two consistent automatically if either is retuned.

### 7.3 `claim_daily_bonus`

No logic change; reads the new `daily_bonus` values from config.

### 7.4 New read helper

```
get_play_status() RETURNS JSONB
  -> { free_plays_remaining, free_plays_per_day, resets_at }
```

`SECURITY DEFINER`, callable by `authenticated`. The client needs this to
render remaining plays without computing UTC dates itself.

---

## 8. Client changes

- `services/economyService.ts`: `payEntryFee` becomes `enterPuzzle`; add
  `getPlayStatus`; `spendOnHint` drops its `letterCount` argument.
- `app/game/generate.tsx`, `app/category/[id].tsx`, `app/collection/index.tsx`:
  call `enterPuzzle` and surface `was_free` and `free_plays_remaining`.
- `components/modals/HintOptionsModal.tsx`: display the flat word price and
  remove the `getUnrevealedLetterCount` call that fed the charge.
- `app/(tabs)/index.tsx`: show free plays remaining on the home screen.
- Puzzle list cards: show "Free" or the coin cost, driven by the remaining
  allowance rather than a hardcoded fee.
- `types/puzzle.types.ts`: remove the `ENTRY_FEES` constant. Prices come from
  config; a bundled copy would drift.

**Out-of-plays framing.** When allowance and coins are both exhausted, the
message is a completion, not a wall: "You've finished today's set — new puzzles
at midnight." The visual design of that state belongs to sub-project 4, but the
copy is fixed here, because it is the difference between a good review and a
bad one.

---

## 9. Testing

Extends the existing Jest and integration suites.

- `enter_puzzle` grants exactly `free_plays.per_day` free entries per UTC day.
- The daily challenge is free and does **not** decrement the allowance.
- Re-entering a started puzzle is free and returns `replayed = true`.
- Once the allowance is spent, entry charges `overflow_fees[difficulty]`.
- Entry with an insufficient balance fails and writes no `puzzle_entries` row.
- The allowance resets across a UTC date boundary.
- `spend_on_hint('reveal_word')` charges exactly 120 regardless of word length.
- `claim_daily_bonus` returns 20 at streak 0 and 150 at streak 13+.
- A new user's welcome bonus is 300.
- Sum of `coin_ledger.delta` still equals `users.coins`.

## 10. Migration

A single migration, `012_economy_rebalance.sql`. There are no production users,
so no backfill is required. Existing `coin_ledger` history is retained and
remains valid — only future prices change. Existing balances are left as they
are.

## 11. Accepted risks

- **The streak cliff steepens.** At day 14 the bonus is 150/day; one missed day
  drops it to 30, a ~47% income cut. Accepted here — streak freeze and repair
  belong in sub-project 3, alongside the notification that makes a freeze
  useful. A softer reset was considered and rejected: it blunts the cliff and
  the streak's meaning together.
- **Skilled players earn far more.** An expert solver earns 4× a medium solver
  from the same four free plays. Intentional: overflow scales identically, so
  total plays per day stay the same, and mastery is rewarded without creating a
  farm.
- **The Elite pack may over-serve.** At 15,000 coins it covers ~75 days of heavy
  play, which caps repeat purchases. Left as-is for launch because no play-rate
  data exists yet, and a too-generous top tier is a better first-review problem
  than a stingy one. Product IDs are permanent; coin amounts are one UPDATE
  away.
- **Word-reveal hint penalties get slightly harsher**, since the server records
  the clue's full length rather than the letters actually uncovered. Accepted as
  the cost of removing client influence over its own penalty.

## 12. Programme context

Sub-project 2 of 6. Completed: 1 (server-authoritative economy). Remaining:
3) retention systems, 4) onboarding and UX polish, 5) content pipeline
reliability, 6) store launch readiness.

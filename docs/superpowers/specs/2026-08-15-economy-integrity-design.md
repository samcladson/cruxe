# Cruxe — Server-Authoritative Economy & Integrity

**Date:** 2026-08-15
**Status:** Approved design, ready for implementation planning
**Sub-project:** 1 of 6 (see "Programme context")

---

## 1. Problem

Cruxe's currency, scores, and purchases are all written by the client. The
consequences are not theoretical:

1. **Coins are forgeable.** `users.coins` is a Zustand value persisted to
   AsyncStorage and upserted to Supabase by `userStore.syncToSupabase`. RLS
   checks *who* is writing, never *what* they write. Any user with a rooted
   device or an HTTP proxy mints unlimited currency, which reduces the value of
   every in-app purchase to zero.
2. **Purchases can take money and deliver nothing.** `store.tsx` grants coins by
   regexing trailing digits off the RevenueCat product identifier and calling a
   local `addCoins`. There is no webhook, no server ledger, and no idempotency.
   Killing the app between the store confirmation and that line loses the
   purchase permanently, because consumables are not restorable. A SKU such as
   `cruxe_pack_v2` grants 2 coins.
3. **Scores are forgeable.** `puzzle_completions.score` is client-supplied and
   the RLS policy validates only `user_id`. The leaderboard is decorative.
4. **The `users` table is world-readable.** Migration 003 adds
   `"Anyone can read leaderboard data" USING (true)`. Postgres ORs permissive
   policies, so this overrides the "own profile only" policy and exposes every
   player's coins, streak, and last-played date to any client.
5. **Account deletion does not exist**, which fails Apple guideline 5.1.1(v) and
   Google Play policy for apps that create accounts.

### 1.1 A blocking discovery

`crosswordEngine.buildPuzzle` is **non-deterministic** — it shuffles the word
pool with `Math.random()` on retry attempts — and the client builds the grid
locally from a bare word list stored in `daily_puzzles.puzzle_data`.

This has three consequences, only one of which is about security:

- The server cannot reproduce the grid a player saw, so cell-level verification
  is impossible without a structural change.
- Players do not actually share a puzzle. Two people solving the same daily get
  different layouts with different crossing counts and therefore different real
  difficulty, so leaderboard comparisons are already invalid.
- The five-minute puzzle cache means reopening a puzzle can rebuild it into a
  different layout than the saved progress belongs to.

**Grid construction therefore moves from the client to the generation script.**
This is a hard prerequisite for verification and independently fixes fairness
and session resume.

---

## 2. Goals

- No client can create, alter, or destroy currency.
- No client can report its own score.
- A completed purchase always results in exactly one coin grant, eventually,
  even across app kills, network loss, and duplicate webhook deliveries.
- No user can read another user's private fields.
- The app satisfies Apple and Google account-deletion requirements.
- Crashes and a minimal funnel are observable in production.

## 3. Non-goals

Deliberately excluded; each belongs to a later sub-project.

- Rebalancing coin values, entry fees, or hint prices (sub-project 2). This
  design makes those values server-owned and tunable, but changes none of them.
- Push notifications, achievements, leagues, streak repair (sub-project 3).
- Onboarding and UX changes (sub-project 4), except where a flow must change
  because the client can no longer write its own rewards.
- Puzzle-content quality and pipeline reliability (sub-project 5), except for
  moving grid construction server-side, which this design requires.
- Store listings and launch assets (sub-project 6).

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Hybrid: plpgsql RPCs own the ledger; a Deno Edge Function owns solve verification | Coin movements need single-transaction atomicity. Verification needs the scoring formula, which must not be duplicated in two languages while sub-project 2 is actively retuning it. |
| D2 | Scoring logic lives once, at `supabase/functions/_shared/scoring.ts` | Metro resolves it for the client, Deno resolves it for the Edge Function. Client preview and server truth cannot drift. |
| D3 | Submission validation without play sessions | Chosen by the product owner. Grid is verified against the answer key; solve time stays client-reported and is clamped. Sessions are the documented upgrade path if telemetry shows time-faking. |
| D4 | Solving works offline; rewards are explicitly pending until submitted | Avoids showing an optimistic coin total that the server may later contradict. |
| D5 | Prices and reward constants live in an `economy_config` table | The client never transmits an amount. Also makes sub-project 2 a config change rather than an app release. |
| D6 | `economy_config` is seeded and changed via source-controlled migrations | The DB row is runtime authority; the migration is the source of truth. Dashboard edits are reserved for emergencies and are audited via `updated_at`. |
| D7 | Grids are built at generation time and stored | Required by D3; independently fixes puzzle fairness and session resume. |
| D8 | Clean-slate migration, no backfill | No real users exist. Existing rows are truncated and puzzles regenerated. |

---

## 5. Data model

### 5.1 New tables

```sql
create type coin_reason as enum (
  'welcome_bonus','daily_bonus','solve_reward','entry_fee',
  'hint_reveal_letter','hint_reveal_word','hint_check_errors',
  'iap_purchase','refund','admin_adjust'
);

-- Append-only financial truth. users.coins is the materialised balance.
create table coin_ledger (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  delta           int  not null check (delta <> 0),
  reason          coin_reason not null,
  balance_after   int  not null,
  idempotency_key text not null unique,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index on coin_ledger (user_id, created_at desc);

-- Hint usage, including free actions that move no money.
-- submit_solve derives the hint penalty from this table, never from the client.
create table hint_events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  puzzle_id  uuid not null references daily_puzzles(id) on delete cascade,
  hint_type  text not null,
  cost       int  not null default 0,
  action_id  uuid not null unique,
  created_at timestamptz not null default now()
);
create index on hint_events (user_id, puzzle_id);

-- Runtime-authoritative economy constants. Seeded by migration.
create table economy_config (
  key        text primary key,
  value      jsonb not null,
  version    int not null default 1,
  updated_at timestamptz not null default now()
);

-- Store SKU -> coin amount. Replaces the client-side regex.
create table coin_products (
  product_id    text primary key,
  coins         int  not null check (coins > 0),
  display_name  text not null,
  bonus_percent int  not null default 0,
  is_active     boolean not null default true
);

-- Raw purchase events for audit, reconciliation, and replay detection.
create table iap_events (
  event_id   text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  product_id text,
  event_type text not null,
  is_sandbox boolean not null default false,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

-- Public per-puzzle aggregates. Replaces reading puzzle_completions directly.
create table puzzle_stats (
  puzzle_id         uuid primary key references daily_puzzles(id) on delete cascade,
  players_completed int not null default 0,
  avg_score         numeric,
  updated_at        timestamptz not null default now()
);
```

### 5.2 Altered tables

- `puzzle_completions.user_id`: `TEXT` → `UUID`, with a foreign key to
  `auth.users(id)` and `ON DELETE CASCADE`. Removes the `u.id::text` cast in the
  leaderboard join and a class of orphan-row bugs.
- `puzzle_completions`: add `suspect boolean not null default false` and
  `reported_time_seconds int` to retain the raw client claim alongside the
  clamped value used for scoring.
- `daily_puzzles.puzzle_data`: now stores the fully built grid and clue list, not
  only a word list.
- `users`: add index on `total_score desc` for leaderboard reads.
- `users`: add `last_daily_bonus_date date`. This field exists only in the
  client's `UserProfile` type today, so the daily bonus cannot move server-side
  without it.

### 5.3 Seeded `economy_config` keys

`welcome_bonus`, `daily_bonus` (base, per-streak increment, cap), `entry_fees`
(per difficulty), `solve_rewards` (per difficulty), `hint_prices`
(reveal_letter, reveal_word_per_letter, check_errors, free_checks_count),
`scoring` (difficulty bases, grid multipliers, time factors, hint penalty,
minimum scores), and `time_bounds` (floor coefficients, ceiling).

Values are seeded to match today's constants exactly. **This design changes no
number**; it only relocates ownership.

---

## 6. Server surface

### 6.1 Internal

```
ledger_apply(user_id, delta, reason, idempotency_key, metadata,
             allow_negative default false) -> int  -- new balance
```

`SECURITY DEFINER`. In one transaction: return the existing balance if the
idempotency key was already applied; `SELECT ... FOR UPDATE` the user row so
concurrent callers serialise; reject a negative result unless `allow_negative`;
update `users.coins` and append the ledger row together.

Row locking closes double-spend races (two fast hint taps). Idempotency makes
every caller — offline queue, flaky network, duplicated webhook — safe to retry
blindly.

**Idempotency key conventions**

| Movement | Key |
|---|---|
| Welcome bonus | `welcome:{user_id}` |
| Solve reward | `solve:{user_id}:{puzzle_id}` |
| Entry fee | `entry:{user_id}:{puzzle_id}` |
| Daily bonus | `daily:{user_id}:{YYYY-MM-DD}` |
| Hint purchase | `hint:{action_id}` |
| IAP grant | `rc:{revenuecat_event_id}` |
| IAP refund | `rc_refund:{revenuecat_event_id}` |

### 6.2 Callable by `authenticated`

```
spend_on_hint(puzzle_id, hint_type, action_id,
              letter_count default 1)          -> { balance, cost }
pay_entry_fee(puzzle_id)                       -> { balance, fee }
claim_daily_bonus()                            -> { bonus, streak, balance }
set_display_name(name)                         -> { display_name }
get_leaderboard(limit, scope)                  -> rows
```

Per-puzzle player counts are read directly from the publicly readable
`puzzle_stats` table (§8) rather than through an RPC.

The client never sends an amount. `spend_on_hint` and `pay_entry_fee` derive
price from `economy_config` and the puzzle's own difficulty. `action_id` is a
client-generated UUID per hint tap, which makes a retried tap free rather than
double-charged.

`set_display_name` exists rather than a column grant because a public
leaderboard requires server-side validation of length, charset, and profanity.

`spend_on_hint`'s `letter_count` is the one client-supplied quantity in the
economy, because the remaining unrevealed letters of a word depend on what the
player has typed — private client state the server cannot observe. The server
clamps it to `[1, clue_length]` using the clue it owns, and records both the
reported and charged values. The residual exposure is that a tampered client buys
hints *more cheaply*; it cannot mint currency, and the discrepancy is visible in
`hint_events`. Flat per-difficulty pricing for reveal-word would close this
completely and should be considered in sub-project 2, where changing a price is
in scope.

`get_leaderboard` is `SECURITY DEFINER` and returns an explicit column list —
display name, total score, solve count, streak, rank — so it structurally cannot
leak private fields regardless of how `users` evolves. It reads the
incrementally maintained `users.total_score` with an index rather than
aggregating `puzzle_completions` on every call. It excludes players below a
minimum solve count, because anonymous accounts are cheap to mint and an
unfloored ladder is farmable.

### 6.3 Service-role only

```
submit_solve(user_id, puzzle_id, accuracy, clamped_time, reported_time,
             hints_used, score, breakdown, suspect) -> completion result
credit_purchase(user_id, product_id, event_id, payload) -> balance
```

`EXECUTE` is revoked from `authenticated`. Both are idempotent; a replay returns
the original stored result rather than erroring, which is what makes the offline
queue safe.

`submit_solve` writes the completion row, credits the solve reward, and updates
`users.total_score` / `puzzles_solved` / streak in one transaction.

### 6.4 Edge Functions

| Function | Auth | Purpose |
|---|---|---|
| `submit-solve` | JWT | Verify grid against answer key, recompute score, call `submit_solve` |
| `revenuecat-webhook` | Shared secret, `verify_jwt = false` | Durable purchase grants |
| `sync-purchases` | JWT | Reconcile missing grants from RevenueCat REST API |
| `delete-account` | JWT | Delete auth user and RevenueCat subscriber |

---

## 7. Flows

### 7.1 Solve submission

```
POST /functions/v1/submit-solve
{ puzzleId, letters, clientElapsedSeconds }
-> { score, grade, breakdown, coinsEarned, newBalance, verified }
```

1. Resolve `user_id` from the verified JWT. The body never carries a user id.
2. Load the stored grid with the service role.
3. Compare submitted letters, in canonical row-major order over fillable cells,
   against the answer key. Derive accuracy and genuine completion.
4. Derive hints used by counting this user's `hint_events` for this puzzle. The
   hint penalty cannot be dodged.
5. Clamp `clientElapsedSeconds` into the band from `economy_config.time_bounds`.
   Below the floor, clamp for scoring and set `suspect = true`, retaining the raw
   value in `reported_time_seconds`.
6. Recompute the score with the shared scoring module and config constants. The
   client's claimed score is never read; it is not in the payload.
7. Call `submit_solve`, idempotent on `solve:{user}:{puzzle}`.
8. Return the authoritative result. The client replaces its predicted display.

Offline, the completion is queued and the success modal states the reward is
pending. No optimistic coin total is shown. On drain, the server's reward
arrives as a toast.

### 7.2 Purchase

1. Client presents the offering and calls RevenueCat. It grants nothing.
2. On store confirmation the client shows "confirming" and subscribes to
   realtime on its own `coin_ledger` rows, which RLS already permits.
3. RevenueCat posts to `revenuecat-webhook`. The function compares the shared
   secret in constant time, records the raw event in `iap_events`, resolves the
   SKU through `coin_products`, and calls `credit_purchase` keyed `rc:{event.id}`.
4. The realtime ledger insert updates the balance, typically within ~2s.
5. If no credit arrives within a timeout, the UI reassures rather than alarms and
   reconciles on next foreground.

An unknown SKU is rejected loudly and alerted, never granted a guessed amount.

**Refunds** debit via `refund` with `allow_negative := true`. Without this a user
could buy, spend, refund, and keep the value. The player earns back to zero.
Repeat refunders are flagged.

**Restore Purchases** becomes `sync-purchases`, which queries RevenueCat for the
user's non-subscription transactions and credits any not present in
`iap_events`. Today the button shows a success alert and grants nothing, because
consumables do not restore — misleading enough to be a review risk. This makes it
a genuine recovery path and the safety net for a dropped webhook.

### 7.3 Profile creation

A trigger on `auth.users` atomically inserts the profile row and writes the
`welcome_bonus` ledger entry. `ensureUserProfile` is deleted from the client.
The bonus can no longer be re-farmed by clearing app storage, because it is keyed
to a server-side identity.

---

## 8. Security model

`users` becomes entirely read-only to clients:

```sql
revoke insert, update, delete on users from authenticated;
drop policy "Anyone can read leaderboard data" on users;
```

`puzzle_completions` drops `INSERT` and `UPDATE` for `authenticated` and becomes
service-role-write, own-row-read. `recordCompletion`'s direct table write is
deleted from the client. This closes the forged-score hole at its source rather
than validating around it.

Tightening completion reads breaks two existing features, both replaced rather
than exempted:

- The home screen's realtime player counter subscribes to INSERTs on
  `puzzle_completions` and stops receiving other users' rows. It moves to
  `puzzle_stats`, which holds only aggregates, is publicly readable and
  realtime-subscribable, and additionally supplies average score for a "you beat
  N% of solvers" line on results.
- `getDailyPlayerCount` reads `puzzle_stats` instead of counting a table it can
  no longer see.

`coin_ledger`: own-row `SELECT` only, no client writes. This yields a
transaction-history screen almost free.

`economy_config` and `coin_products`: public `SELECT` for display, service-role
write.

Enable Supabase CAPTCHA on anonymous sign-in before launch (dashboard setting).

---

## 9. Observability

- **Sentry** (`@sentry/react-native`) with sourcemap upload in the EAS build.
  PII scrubbed; anonymous user id attached for correlation.
- **Analytics**, minimal and deliberate: onboarding started/completed, first
  solve, puzzle started/completed/abandoned, hint used, store viewed, purchase
  started/completed/failed, daily bonus claimed, streak broken. Chosen to answer
  the questions sub-projects 2 and 3 will ask.
- Collection must match Data Safety and privacy-manifest declarations.
- Alerting on: unknown SKU, webhook auth failure, `suspect` submission rate,
  ledger-versus-balance reconciliation drift.

## 10. Testing

Jest + ts-jest; the project currently has no runner, only a stub test. Priority
is server correctness, not UI:

- `ledger_apply` under concurrent calls (no double-spend, no lost update).
- `ledger_apply` idempotency: same key twice yields one row, one balance change.
- `submit_solve` replay returns the identical stored result.
- Webhook replay credits exactly once.
- Refund drives balance negative; spend does not.
- Scoring module arithmetic, including clamping and grade boundaries.
- Grid verification: correct, partial, and wrong submissions.

## 11. Migration & sequencing

No real users exist, so this collapses to a single bundle:

1. Migration: create new tables, seed `economy_config` and `coin_products`, alter
   `puzzle_completions`, install the `auth.users` trigger, revoke client writes,
   replace the leaderboard view with `get_leaderboard`, add `puzzle_stats` and
   its trigger.
2. Truncate `puzzle_completions` and `daily_puzzles`.
3. Move `buildPuzzle` into the generation script; rerun to produce grid-bearing
   puzzles.
4. Deploy the four Edge Functions; configure the RevenueCat webhook secret.
5. Ship the client against the new surface in a single version.

No compatibility shims, no phased rollout, no backfill. This is the cheapest
moment this change will ever be available.

## 12. Accepted risks and upgrade paths

- **Solve time remains client-reported** (D3). Mitigated by clamping and
  `suspect` flagging. If telemetry shows meaningful time-faking, add play
  sessions with a server-side start timestamp; the payload already carries a
  puzzle id, so this is additive.
- **Answers remain present on the client**, which is unavoidable for offline
  solving. This permits auto-solving but not score forgery: a cheat can only
  submit a genuinely correct grid. Detection belongs to anomaly telemetry, not
  to this design.
- **Edge Function cold start** of roughly 200–500 ms on submission, which lands
  behind the completion animation.
- **Anonymous account minting** is bounded by the leaderboard's minimum solve
  floor and by CAPTCHA, not eliminated.

## 13. Programme context

This is sub-project 1 of 6 identified in the product audit. The remainder, in
recommended order: 2) economy and difficulty rebalance, 3) retention systems,
4) onboarding and UX polish, 5) content pipeline reliability, 6) store launch
readiness. Each gets its own design and plan.

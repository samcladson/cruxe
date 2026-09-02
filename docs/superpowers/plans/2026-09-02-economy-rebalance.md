# Economy Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-net-positive entry-fee economy with a free daily allowance plus paid overflow, and fix hint pricing so free players actually use hints.

**Architecture:** A new `puzzle_entries` table records every puzzle entry — free ones included — so the server can count a player's remaining free plays for the UTC day. `pay_entry_fee` becomes `enter_puzzle`, which grants a free slot, waives the daily challenge, or charges an overflow fee. Every number stays in `economy_config`, so the values remain tunable without an app release.

**Tech Stack:** Supabase (Postgres plpgsql RPCs), Expo 54 / React Native 0.81, TypeScript, Zustand, Jest.

**Spec:** `docs/superpowers/specs/2026-09-02-economy-rebalance-design.md`

## Global Constraints

- **The client never sends a price, an amount, or a quantity.** After this project there is no client-supplied number anywhere in the economy — `spend_on_hint`'s `p_letter_count` is removed, and nothing replaces it.
- **Exact values, copied from the spec.** Free plays per day: 3. Overflow fees easy/medium/hard/expert: 20/50/100/200. Solve rewards (unchanged): 10/25/50/100. Reveal letter: 30. Reveal word: 120 flat. Check errors: 20 after 5 free **per puzzle**. Daily bonus: `min(150, 20 + 10 × streak)`. Welcome bonus: 300.
- **The daily challenge is always free and never consumes an allowance slot.**
- **Re-entering an already-started puzzle is always free**, regardless of remaining allowance or balance.
- **Word-reveal hint penalty** = `reveal_word_flat / reveal_letter` letters (4), derived from config, never from the client.
- All new SQL functions declare `SECURITY DEFINER` and `SET search_path = public`.
- Migrations continue sequentially from `011_coin_product_ladder.sql`.
- Out-of-plays copy is fixed: **"You've finished today's set — new puzzles at midnight."**

## Test Strategy

Same two layers as sub-project 1:

- **Unit (Jest):** pure TypeScript only. Nothing in this project is pure logic, so unit coverage is unchanged.
- **Integration (Jest against the real Supabase dev project):** all new SQL, driven through `@supabase/supabase-js`. Reads `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY`; skips cleanly when unset.

Tests create and delete their own users via `auth.admin`. Reuse `__tests__/integration/setup.ts` as-is — `createSignedInUser` and `anyPuzzleId` already do what's needed.

## File Structure

**Created**
- `supabase/migrations/012_economy_rebalance.sql` — table, config changes, `enter_puzzle`, `get_play_status`, revised `spend_on_hint`
- `__tests__/integration/playAllowance.test.ts` — allowance, overflow, daily-challenge exemption, re-entry
- `__tests__/integration/hintPricing.test.ts` — flat word price, penalty units, unchanged letter price

**Modified**
- `services/economyService.ts` — `payEntryFee` → `enterPuzzle`; add `getPlayStatus`; `spendOnHint` loses its `letterCount` argument
- `app/game/generate.tsx`, `app/category/[id].tsx`, `app/collection/index.tsx` — call `enterPuzzle`, show free/cost per card
- `components/modals/HintOptionsModal.tsx` — flat word price
- `app/(tabs)/index.tsx` — free plays remaining
- `types/puzzle.types.ts` — delete `ENTRY_FEES`

---

### Task 1: Schema and config

**Files:**
- Create: `supabase/migrations/012_economy_rebalance.sql`

**Interfaces:**
- Consumes: `economy_config`, `coin_ledger`, `ledger_apply` from migrations 005–008.
- Produces: table `puzzle_entries`; config keys `free_plays`, `overflow_fees`, `streak`; revised `welcome_bonus`, `daily_bonus`, `hint_prices`. Tasks 2 and 3 depend on all of these.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Cruxe Migration 012: economy rebalance
-- See docs/superpowers/specs/2026-09-02-economy-rebalance-design.md
-- ============================================================

-- Records every puzzle entry, including free ones. The ledger cannot serve
-- this purpose because a free play moves no money.
CREATE TABLE IF NOT EXISTS puzzle_entries (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id  UUID NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,          -- UTC date the entry was granted
  cost       INT  NOT NULL,          -- 0 for free plays and the daily challenge
  was_free   BOOLEAN NOT NULL,       -- TRUE only when an allowance slot was used
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, puzzle_id)
);
CREATE INDEX IF NOT EXISTS idx_entries_user_date
  ON puzzle_entries (user_id, entry_date);

ALTER TABLE puzzle_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own entries" ON puzzle_entries;
CREATE POLICY "Users read own entries"
  ON puzzle_entries FOR SELECT USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON puzzle_entries FROM authenticated, anon;

-- ---------- config ----------

-- entry_fees is replaced by overflow_fees: a fee now applies only after the
-- free allowance is exhausted, and is 2x the solve reward so that total daily
-- plays come out the same at every difficulty.
DELETE FROM economy_config WHERE key = 'entry_fees';

INSERT INTO economy_config (key, value) VALUES
  ('free_plays',    '{"per_day": 3, "daily_challenge_free": true}'::JSONB),
  ('overflow_fees', '{"easy": 20, "medium": 50, "hard": 100, "expert": 200}'::JSONB),
  -- Placeholder so sub-project 3 can add freeze_cost and grace_days without
  -- restructuring anything.
  ('streak',        '{}'::JSONB)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

UPDATE economy_config
   SET value = '{"coins": 300}'::JSONB, updated_at = NOW()
 WHERE key = 'welcome_bonus';

UPDATE economy_config
   SET value = '{"base": 20, "per_streak_day": 10, "cap": 150}'::JSONB,
       updated_at = NOW()
 WHERE key = 'daily_bonus';

-- reveal_word_per_letter (30 x letters, up to 360) is replaced by a flat
-- price. This kills the cliff and removes the last client-supplied quantity.
UPDATE economy_config
   SET value = '{"reveal_letter": 30, "reveal_word_flat": 120,
                 "check_errors": 20, "free_checks_count": 5}'::JSONB,
       updated_at = NOW()
 WHERE key = 'hint_prices';
```

- [ ] **Step 2: Apply the migration**

Paste into the Supabase SQL Editor and run.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify the config**

```sql
SELECT key, jsonb_pretty(value) FROM economy_config ORDER BY key;
```

Expected: 10 rows. `entry_fees` is **absent**. `hint_prices` has `reveal_word_flat` 120 and no `reveal_word_per_letter`. `welcome_bonus` is 300. `daily_bonus` is base 20 / per_streak_day 10 / cap 150.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_economy_rebalance.sql
git commit -m "feat(db): free-play allowance schema and rebalanced economy config"
```

---

### Task 2: `enter_puzzle` and `get_play_status`

**Files:**
- Modify: `supabase/migrations/012_economy_rebalance.sql` (append)
- Create: `__tests__/integration/playAllowance.test.ts`

**Interfaces:**
- Consumes: `puzzle_entries`, `free_plays`, `overflow_fees` (Task 1); `ledger_apply` (migration 006).
- Produces:
  - `enter_puzzle(p_puzzle_id UUID) RETURNS JSONB` → `{ cost, was_free, balance, free_plays_remaining, replayed }`
  - `get_play_status() RETURNS JSONB` → `{ free_plays_remaining, free_plays_per_day, resets_at }`

  Tasks 4–7 call both through `services/economyService.ts`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/integration/playAllowance.test.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import {
  createSignedInUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("enter_puzzle allowance", () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let mediums: string[] = [];
  let dailyChallengeId: string | null = null;

  beforeAll(async () => {
    admin = serviceClient();

    const { data } = await admin
      .from("daily_puzzles")
      .select("id, is_daily_challenge")
      .eq("difficulty", "medium")
      .eq("is_daily_challenge", false)
      .order("puzzle_date", { ascending: false })
      .limit(8);
    mediums = (data ?? []).map((r: any) => r.id);
    if (mediums.length < 6) {
      throw new Error(
        "Need at least 6 medium puzzles in the test database. " +
          "Run scripts/generate-daily-puzzles-free.ts first.",
      );
    }

    const { data: dc } = await admin
      .from("daily_puzzles")
      .select("id")
      .eq("is_daily_challenge", true)
      .order("puzzle_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    dailyChallengeId = dc?.id ?? null;
  });

  beforeEach(async () => {
    const signedIn = await createSignedInUser(admin);
    userId = signedIn.userId;
    user = signedIn.client;
    await admin.from("users").update({ coins: 1000 }).eq("id", userId);
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
  });

  const enter = (puzzleId: string) =>
    user.rpc("enter_puzzle", { p_puzzle_id: puzzleId });

  it("grants exactly three free plays per day", async () => {
    const a = await enter(mediums[0]);
    expect(a.data.was_free).toBe(true);
    expect(a.data.cost).toBe(0);
    expect(a.data.free_plays_remaining).toBe(2);

    const b = await enter(mediums[1]);
    expect(b.data.free_plays_remaining).toBe(1);

    const c = await enter(mediums[2]);
    expect(c.data.free_plays_remaining).toBe(0);

    // Balance untouched by free plays
    const { data: row } = await admin
      .from("users").select("coins").eq("id", userId).single();
    expect(row!.coins).toBe(1000);
  });

  it("charges the overflow fee once the allowance is spent", async () => {
    await enter(mediums[0]);
    await enter(mediums[1]);
    await enter(mediums[2]);

    const overflow = await enter(mediums[3]);
    expect(overflow.error).toBeNull();
    expect(overflow.data.was_free).toBe(false);
    expect(overflow.data.cost).toBe(50); // medium
    expect(overflow.data.balance).toBe(950);
  });

  it("re-entering a started puzzle is always free", async () => {
    await enter(mediums[0]);
    await enter(mediums[1]);
    await enter(mediums[2]);
    await enter(mediums[3]); // paid 50, balance 950

    const again = await enter(mediums[3]);
    expect(again.data.replayed).toBe(true);
    expect(again.data.cost).toBe(0);
    expect(again.data.balance).toBe(950); // not charged twice
  });

  it("does not charge or consume a slot for the daily challenge", async () => {
    if (!dailyChallengeId) {
      console.warn("No daily challenge row; skipping.");
      return;
    }
    const dc = await enter(dailyChallengeId);
    expect(dc.data.cost).toBe(0);
    expect(dc.data.was_free).toBe(false); // did not use a slot
    expect(dc.data.free_plays_remaining).toBe(3); // untouched

    const first = await enter(mediums[0]);
    expect(first.data.free_plays_remaining).toBe(2);
  });

  it("refuses entry and records nothing when the balance is short", async () => {
    await admin.from("users").update({ coins: 10 }).eq("id", userId);
    await enter(mediums[0]);
    await enter(mediums[1]);
    await enter(mediums[2]);

    const broke = await enter(mediums[3]);
    expect(broke.error).not.toBeNull();
    expect(broke.error!.message).toContain("insufficient_coins");

    const { count } = await admin
      .from("puzzle_entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("puzzle_id", mediums[3]);
    expect(count).toBe(0);
  });

  it("resets the allowance on a new UTC day", async () => {
    await enter(mediums[0]);
    await enter(mediums[1]);
    await enter(mediums[2]);

    // Backdate today's entries to simulate the date rolling over.
    await admin
      .from("puzzle_entries")
      .update({ entry_date: "2020-01-01" })
      .eq("user_id", userId);

    const status = await user.rpc("get_play_status");
    expect(status.data.free_plays_remaining).toBe(3);
  });

  it("reports play status without consuming anything", async () => {
    const before = await user.rpc("get_play_status");
    expect(before.data.free_plays_per_day).toBe(3);
    expect(before.data.free_plays_remaining).toBe(3);

    await enter(mediums[0]);

    const after = await user.rpc("get_play_status");
    expect(after.data.free_plays_remaining).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/integration/playAllowance.test.ts`
Expected: FAIL — `Could not find the function public.enter_puzzle`.

- [ ] **Step 3: Append the functions to the migration**

```sql
-- ---------- enter_puzzle ----------
-- Replaces pay_entry_fee, which always charged. Entry is now free until the
-- daily allowance runs out; the daily challenge is always free and never
-- consumes a slot.
CREATE OR REPLACE FUNCTION public.enter_puzzle(p_puzzle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_today    DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_existing RECORD;
  v_puzzle   RECORD;
  v_per_day  INT;
  v_used     INT;
  v_fee      INT;
  v_balance  INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT (value->>'per_day')::INT INTO v_per_day
    FROM economy_config WHERE key = 'free_plays';
  IF v_per_day IS NULL THEN RAISE EXCEPTION 'missing_config:free_plays'; END IF;

  SELECT COUNT(*) INTO v_used FROM puzzle_entries
   WHERE user_id = v_user AND entry_date = v_today AND was_free;

  -- Re-entry is always free: never punish closing the app mid-solve.
  SELECT cost, was_free INTO v_existing
    FROM puzzle_entries WHERE user_id = v_user AND puzzle_id = p_puzzle_id;
  IF FOUND THEN
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object(
      'cost', 0, 'was_free', v_existing.was_free, 'balance', v_balance,
      'free_plays_remaining', GREATEST(v_per_day - v_used, 0),
      'replayed', TRUE);
  END IF;

  SELECT difficulty, is_daily_challenge INTO v_puzzle
    FROM daily_puzzles WHERE id = p_puzzle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'puzzle_not_found'; END IF;

  -- Daily challenge: free, and outside the allowance entirely.
  IF v_puzzle.is_daily_challenge THEN
    INSERT INTO puzzle_entries (user_id, puzzle_id, entry_date, cost, was_free)
    VALUES (v_user, p_puzzle_id, v_today, 0, FALSE);
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object(
      'cost', 0, 'was_free', FALSE, 'balance', v_balance,
      'free_plays_remaining', GREATEST(v_per_day - v_used, 0),
      'replayed', FALSE);
  END IF;

  -- Within the free allowance.
  IF v_used < v_per_day THEN
    INSERT INTO puzzle_entries (user_id, puzzle_id, entry_date, cost, was_free)
    VALUES (v_user, p_puzzle_id, v_today, 0, TRUE);
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object(
      'cost', 0, 'was_free', TRUE, 'balance', v_balance,
      'free_plays_remaining', GREATEST(v_per_day - v_used - 1, 0),
      'replayed', FALSE);
  END IF;

  -- Overflow. ledger_apply raises insufficient_coins, which rolls back this
  -- whole function — so a refused entry leaves no puzzle_entries row.
  SELECT (value->>v_puzzle.difficulty)::INT INTO v_fee
    FROM economy_config WHERE key = 'overflow_fees';
  IF v_fee IS NULL THEN RAISE EXCEPTION 'missing_config:overflow_fees'; END IF;

  v_balance := ledger_apply(
    v_user, -v_fee, 'entry_fee',
    'entry:' || v_user::TEXT || ':' || p_puzzle_id::TEXT,
    jsonb_build_object('puzzle_id', p_puzzle_id, 'overflow', TRUE));

  INSERT INTO puzzle_entries (user_id, puzzle_id, entry_date, cost, was_free)
  VALUES (v_user, p_puzzle_id, v_today, v_fee, FALSE);

  RETURN jsonb_build_object(
    'cost', v_fee, 'was_free', FALSE, 'balance', v_balance,
    'free_plays_remaining', 0, 'replayed', FALSE);
END;
$$;

-- ---------- get_play_status ----------
CREATE OR REPLACE FUNCTION public.get_play_status()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_today   DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_per_day INT;
  v_used    INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT (value->>'per_day')::INT INTO v_per_day
    FROM economy_config WHERE key = 'free_plays';

  SELECT COUNT(*) INTO v_used FROM puzzle_entries
   WHERE user_id = v_user AND entry_date = v_today AND was_free;

  RETURN jsonb_build_object(
    'free_plays_remaining', GREATEST(COALESCE(v_per_day, 0) - v_used, 0),
    'free_plays_per_day',   COALESCE(v_per_day, 0),
    'resets_at',            ((v_today + 1)::TIMESTAMP AT TIME ZONE 'UTC'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.enter_puzzle(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_play_status()   TO authenticated;

-- pay_entry_fee always charged and had no concept of an allowance.
DROP FUNCTION IF EXISTS public.pay_entry_fee(UUID);
```

- [ ] **Step 4: Apply and rerun**

Run the appended SQL in the Supabase SQL Editor, then:
`npx jest __tests__/integration/playAllowance.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/012_economy_rebalance.sql __tests__/integration/playAllowance.test.ts
git commit -m "feat(db): enter_puzzle with free daily allowance and paid overflow"
```

---

### Task 3: Flat hint pricing

**Files:**
- Modify: `supabase/migrations/012_economy_rebalance.sql` (append)
- Create: `__tests__/integration/hintPricing.test.ts`

**Interfaces:**
- Consumes: `hint_prices` config (Task 1), `ledger_apply`, `hint_events`.
- Produces: `spend_on_hint(p_puzzle_id UUID, p_hint_type TEXT, p_action_id UUID) RETURNS JSONB` → `{ balance, cost, replayed }`. **Three parameters, not four** — Task 4's client wrapper must match.

- [ ] **Step 1: Write the failing test**

Create `__tests__/integration/hintPricing.test.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
  anyPuzzleId,
  createSignedInUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("flat hint pricing", () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let puzzleId: string;

  beforeAll(async () => {
    admin = serviceClient();
    puzzleId = await anyPuzzleId(admin, "medium");
  });

  beforeEach(async () => {
    const signedIn = await createSignedInUser(admin);
    userId = signedIn.userId;
    user = signedIn.client;
    await admin.from("users").update({ coins: 1000 }).eq("id", userId);
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
  });

  const hint = (type: string) =>
    user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: type,
      p_action_id: randomUUID(),
    });

  it("charges 120 for a word reveal regardless of word length", async () => {
    const { data, error } = await hint("reveal_word");
    expect(error).toBeNull();
    expect(data.cost).toBe(120);
    expect(data.balance).toBe(880);
  });

  it("still charges 30 for a letter reveal", async () => {
    const { data } = await hint("reveal_letter");
    expect(data.cost).toBe(30);
    expect(data.balance).toBe(970);
  });

  it("records a word reveal as four letters of penalty", async () => {
    await hint("reveal_word");
    const { data } = await admin
      .from("hint_events")
      .select("hint_type, letters_revealed")
      .eq("user_id", userId)
      .single();
    // 120 flat / 30 per letter = 4: you are penalised what you paid for.
    expect(data!.letters_revealed).toBe(4);
  });

  it("rejects the removed letter_count parameter", async () => {
    const { error } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_word",
      p_action_id: randomUUID(),
      p_letter_count: 1,
    });
    expect(error).not.toBeNull();
  });

  it("keeps five free error checks per puzzle", async () => {
    for (let i = 0; i < 5; i++) {
      const { data } = await hint("check_errors");
      expect(data.cost).toBe(0);
    }
    const { data } = await hint("check_errors");
    expect(data.cost).toBe(20);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/integration/hintPricing.test.ts`
Expected: FAIL — the word reveal costs 30, not 120, because the old per-letter function is still installed.

- [ ] **Step 3: Append the revised function**

```sql
-- ---------- spend_on_hint (flat word pricing) ----------
-- p_letter_count is gone. It was the only client-supplied quantity left in
-- the economy: a tampered client could under-report it to buy cheap hints.
-- A word now costs a flat price, and the hint penalty is derived from the
-- ratio of the two prices rather than from anything the client says.
DROP FUNCTION IF EXISTS public.spend_on_hint(UUID, TEXT, UUID, INT);

CREATE OR REPLACE FUNCTION public.spend_on_hint(
  p_puzzle_id UUID,
  p_hint_type TEXT,
  p_action_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_prices    JSONB;
  v_cost      INT;
  v_reason    coin_reason;
  v_balance   INT;
  v_used_free INT;
  v_letters   INT := 0;
  v_prior     INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_hint_type NOT IN ('reveal_letter','reveal_word','check_errors') THEN
    RAISE EXCEPTION 'unknown_hint_type';
  END IF;

  -- Replay protection: the same tap returns the same answer, charging once.
  SELECT cost INTO v_prior FROM hint_events WHERE action_id = p_action_id;
  IF FOUND THEN
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object('balance', v_balance, 'cost', v_prior,
                              'replayed', TRUE);
  END IF;

  SELECT value INTO v_prices FROM economy_config WHERE key = 'hint_prices';
  IF v_prices IS NULL THEN RAISE EXCEPTION 'missing_config:hint_prices'; END IF;

  IF p_hint_type = 'reveal_letter' THEN
    v_cost    := (v_prices->>'reveal_letter')::INT;
    v_reason  := 'hint_reveal_letter';
    v_letters := 1;

  ELSIF p_hint_type = 'reveal_word' THEN
    v_cost   := (v_prices->>'reveal_word_flat')::INT;
    v_reason := 'hint_reveal_word';
    -- Penalise exactly the number of letters the flat price bought.
    v_letters := GREATEST(
      1, v_cost / NULLIF((v_prices->>'reveal_letter')::INT, 0));

  ELSE -- check_errors
    SELECT COUNT(*) INTO v_used_free
      FROM hint_events
     WHERE user_id = v_user AND puzzle_id = p_puzzle_id
       AND hint_type = 'check_errors';

    IF v_used_free < (v_prices->>'free_checks_count')::INT THEN
      v_cost := 0;
    ELSE
      v_cost := (v_prices->>'check_errors')::INT;
    END IF;
    v_reason := 'hint_check_errors';
  END IF;

  IF v_cost > 0 THEN
    v_balance := ledger_apply(
      v_user, -v_cost, v_reason, 'hint:' || p_action_id::TEXT,
      jsonb_build_object('puzzle_id', p_puzzle_id, 'hint_type', p_hint_type));
  ELSE
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
  END IF;

  INSERT INTO hint_events (user_id, puzzle_id, hint_type, cost,
                           letters_revealed, reported_letter_count, action_id)
  VALUES (v_user, p_puzzle_id, p_hint_type, v_cost, v_letters, NULL,
          p_action_id);

  RETURN jsonb_build_object('balance', v_balance, 'cost', v_cost,
                            'replayed', FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_on_hint(UUID, TEXT, UUID)
  TO authenticated;
```

- [ ] **Step 4: Apply and rerun**

Run the appended SQL, then `npx jest __tests__/integration/hintPricing.test.ts`.
Expected: PASS, 5 tests.

- [ ] **Step 5: Reconcile the sub-project 1 tests**

Those tests assert the pre-rebalance numbers and will now fail. This is expected — they are asserting the very behaviour we just changed. Make exactly these edits:

**`__tests__/integration/playerRpcs.test.ts`**

1. Delete three obsolete cases whose replacements now live in the new files:
   - `prices reveal_word per letter and clamps an inflated count`
   - `charges the entry fee for the puzzle's own difficulty`
   - `does not charge the entry fee twice for the same puzzle`
2. Remove every `p_letter_count:` line from the remaining `spend_on_hint` calls — the parameter no longer exists.
3. Update the daily-bonus expectation, since the formula changed from `15 + 5 × streak` to `20 + 10 × streak`:

```ts
    const first = await user.rpc("claim_daily_bonus");
    expect(first.data.bonus).toBe(40); // 20 + 10 x streak 2
```

4. Add a case pinning both ends of the new curve:

```ts
  it("pays 20 at streak 0 and caps at 150", async () => {
    await admin
      .from("users")
      .update({ current_streak: 0, last_daily_bonus_date: null })
      .eq("id", userId);
    const base = await user.rpc("claim_daily_bonus");
    expect(base.data.bonus).toBe(20);

    await admin
      .from("users")
      .update({ current_streak: 30, last_daily_bonus_date: null })
      .eq("id", userId);
    const capped = await user.rpc("claim_daily_bonus");
    expect(capped.data.bonus).toBe(150); // min(150, 20 + 300)
  });
```

**`__tests__/integration/rls.test.ts`**

The welcome bonus is now 300. Change both assertions:

```ts
    expect(data!.coins).toBe(300);
```

on line 38 (`creates the profile and welcome bonus on signup`) and line 54 (`blocks writing your own coins`, where 300 is now the unchanged value).

Also update the ledger assertion in the same file:

```ts
    expect(led).toEqual([{ reason: "welcome_bonus", delta: 300 }]);
```

**Leave `ledger.test.ts` and `submitSolve.test.ts` alone** — their 200s are arbitrary test amounts and scores, not config values.

- [ ] **Step 5b: Run the whole integration suite**

Run: `npx jest __tests__/integration`
Expected: every suite PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/012_economy_rebalance.sql __tests__/integration/
git commit -m "feat(db): flat reveal-word price; drop the last client-supplied quantity"
```

---

### Task 4: Client service layer

**Files:**
- Modify: `services/economyService.ts`

**Interfaces:**
- Consumes: `enter_puzzle`, `get_play_status`, three-argument `spend_on_hint`.
- Produces: `enterPuzzle(puzzleId): Promise<EnterPuzzleResult>`, `getPlayStatus(): Promise<PlayStatus>`, `spendOnHint(puzzleId, hintType, actionId): Promise<HintChargeResult>`. Tasks 5–7 import these.

- [ ] **Step 1: Replace `payEntryFee` with `enterPuzzle`**

Delete the `EntryFeeResult` interface and the `payEntryFee` function. Add:

```ts
export interface EnterPuzzleResult {
  cost: number;
  was_free: boolean;
  balance: number;
  free_plays_remaining: number;
  replayed: boolean;
}

export interface PlayStatus {
  free_plays_remaining: number;
  free_plays_per_day: number;
  resets_at: string;
}

/**
 * Claims entry to a puzzle. Free while the daily allowance lasts, free
 * forever for the daily challenge and for any puzzle already started, and
 * charged at the overflow rate otherwise. The server decides which.
 */
export async function enterPuzzle(
  puzzleId: string,
): Promise<EnterPuzzleResult> {
  const { data, error } = await supabase.rpc("enter_puzzle", {
    p_puzzle_id: puzzleId,
  });
  if (error) throw rpcError("Entry", error);
  return data as EnterPuzzleResult;
}

export async function getPlayStatus(): Promise<PlayStatus> {
  const { data, error } = await supabase.rpc("get_play_status");
  if (error) throw rpcError("Play status", error);
  return data as PlayStatus;
}
```

- [ ] **Step 2: Drop `letterCount` from `spendOnHint`**

```ts
export async function spendOnHint(
  puzzleId: string,
  hintType: "reveal_letter" | "reveal_word" | "check_errors",
  actionId: string,
): Promise<HintChargeResult> {
  const { data, error } = await supabase.rpc("spend_on_hint", {
    p_puzzle_id: puzzleId,
    p_hint_type: hintType,
    p_action_id: actionId,
  });
  if (error) throw rpcError("Hint", error);
  return data as HintChargeResult;
}
```

- [ ] **Step 3: Update the error map**

In `rpcError`, replace the `insufficient_coins` message so it names the real situation, since after this change it can only occur on overflow entry or a hint:

```ts
    insufficient_coins: "You don't have enough coins for that.",
```

- [ ] **Step 4: Update `HintPrices` usage**

`loadHintPrices` returns the config row; the `HintPrices` interface in `supabase/functions/_shared/economyTypes.ts` still declares `reveal_word_per_letter`. Change it:

```ts
export interface HintPrices {
  reveal_letter: number;
  reveal_word_flat: number;
  check_errors: number;
  free_checks_count: number;
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in the three entry call sites and the hint modal, which Tasks 5 and 6 fix. Record the list.

- [ ] **Step 6: Commit**

```bash
git add services/economyService.ts supabase/functions/_shared/economyTypes.ts
git commit -m "feat(client): enterPuzzle and getPlayStatus; spendOnHint drops letterCount"
```

---

### Task 5: Entry call sites

**Files:**
- Modify: `app/game/generate.tsx:96`
- Modify: `app/category/[id].tsx:216`
- Modify: `app/collection/index.tsx:275`

**Interfaces:**
- Consumes: `enterPuzzle` (Task 4), `applyServerBalance` (userStore).

- [ ] **Step 1: Update `app/game/generate.tsx`**

Replace the `payEntryFee` block:

```ts
        // Free while the daily allowance lasts; the server decides. Charging
        // only after the puzzle resolves means a puzzle that fails to load is
        // never paid for.
        try {
          const { balance } = await enterPuzzle(puzzle.id);
          useUserStore.getState().applyServerBalance(balance);
        } catch (e: any) {
          if (mounted) {
            setErrorMsg(e.message);
            setStatus("error");
          }
          return;
        }
```

Change the import from `payEntryFee` to `enterPuzzle`.

- [ ] **Step 2: Update `app/category/[id].tsx`**

Replace the `payEntryFee` call:

```ts
                    try {
                      const { balance } = await enterPuzzle(puzzle.id);
                      useUserStore.getState().applyServerBalance(balance);
                      setPlayStatus(await getPlayStatus());
                    } catch (e: any) {
                      Alert.alert("Can't start puzzle", e.message, [
                        { text: "OK", style: "default" },
                      ]);
                      return;
                    }
```

Change the import to `enterPuzzle, getPlayStatus`.

- [ ] **Step 3: Show free-or-cost on each card in `app/category/[id].tsx`**

Add state and a loader near the other hooks:

```ts
  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  useEffect(() => {
    getPlayStatus().then(setPlayStatus).catch(() => setPlayStatus(null));
  }, []);

  const [overflowFees, setOverflowFees] = useState<Record<string, number>>({});
  useEffect(() => {
    supabase
      .from("economy_config")
      .select("value")
      .eq("key", "overflow_fees")
      .single()
      .then(({ data }) => setOverflowFees(data?.value ?? {}));
  }, []);
```

Replace the `ENTRY_FEES[puzzle.difficulty as Difficulty]` render at line 260 with:

```tsx
                        {playStatus && playStatus.free_plays_remaining > 0
                          ? "Free"
                          : (overflowFees[puzzle.difficulty] ?? 0)}
```

Import `PlayStatus` and `getPlayStatus` from `../../services/economyService`, and `supabase` from `../../services/supabaseClient`. Remove the `ENTRY_FEES` and `Difficulty` imports if now unused.

- [ ] **Step 4: Apply the equivalent changes to `app/collection/index.tsx`**

Two screens, deliberately not sharing a hook — they differ in surrounding state, and coupling them now would be a premature abstraction.

Replace the `payEntryFee` call at line 275:

```ts
                      try {
                        const { balance } = await enterPuzzle(puzzle.id);
                        useUserStore.getState().applyServerBalance(balance);
                        setPlayStatus(await getPlayStatus());
                      } catch (e: any) {
                        Alert.alert("Can't start puzzle", e.message, [
                          { text: "OK", style: "default" },
                        ]);
                        return;
                      }
```

Add the same two loaders near the other hooks:

```ts
  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  useEffect(() => {
    getPlayStatus().then(setPlayStatus).catch(() => setPlayStatus(null));
  }, []);

  const [overflowFees, setOverflowFees] = useState<Record<string, number>>({});
  useEffect(() => {
    supabase
      .from("economy_config")
      .select("value")
      .eq("key", "overflow_fees")
      .single()
      .then(({ data }) => setOverflowFees(data?.value ?? {}));
  }, []);
```

And replace the `ENTRY_FEES[puzzle.difficulty as Difficulty]` render at line 319:

```tsx
                          {playStatus && playStatus.free_plays_remaining > 0
                            ? "Free"
                            : (overflowFees[puzzle.difficulty] ?? 0)}
```

Update imports: `enterPuzzle, getPlayStatus, PlayStatus` from `../../services/economyService`, `supabase` from `../../services/supabaseClient`. Drop `ENTRY_FEES` and `Difficulty` if now unused.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the hint modal still errors.

- [ ] **Step 6: Commit**

```bash
git add app/game/generate.tsx app/category/ app/collection/
git commit -m "feat(client): free-allowance entry with per-card free-or-cost display"
```

---

### Task 6: Hint modal and `ENTRY_FEES` removal

**Files:**
- Modify: `components/modals/HintOptionsModal.tsx`
- Modify: `types/puzzle.types.ts:14-19`
- Modify: `services/hintEngine.ts`

- [ ] **Step 1: Use the flat word price in the modal**

Replace the price derivation:

```ts
  const letterPrice = prices?.reveal_letter ?? REVEAL_LETTER_COST;
  const wordPrice = prices?.reveal_word_flat ?? 120;
  const checkPrice = prices?.check_errors ?? CHECK_ERRORS_COST;
```

Delete the `unrevealedLetters` `useMemo` and the `revealWordCost` derivation, and replace every use of `revealWordCost` with `wordPrice`. The word hint stays disabled when the word is already complete, which `wordAvailable` already covers, so change the enabled flag to:

```ts
  const wordEnabled = wordAvailable && canAffordHint(wordPrice, coins) && !busy;
```

- [ ] **Step 2: Drop the letter count from the charge**

```ts
  const charge = async (
    hintType: "reveal_letter" | "reveal_word" | "check_errors",
  ) => {
    if (!activePuzzle) throw new Error("no_puzzle");
    const result = await spendOnHint(
      activePuzzle.id,
      hintType,
      Crypto.randomUUID(),
    );
    useUserStore.getState().applyServerBalance(result.balance);
    track("hint_used", { hintType, cost: result.cost });
    return result;
  };
```

Update all three call sites to `await charge("reveal_letter")`, `await charge("reveal_word")`, `await charge("check_errors")`.

Remove the now-unused `getUnrevealedLetterCount` import.

- [ ] **Step 3: Render the flat price**

At the reveal-word price display, replace `{revealWordCost}` with `{wordPrice}`.

- [ ] **Step 4: Delete `ENTRY_FEES`**

In `types/puzzle.types.ts`, remove:

```ts
export const ENTRY_FEES: Record<Difficulty, number> = {
  [Difficulty.EASY]: 5,
  [Difficulty.MEDIUM]: 15,
  [Difficulty.HARD]: 30,
  [Difficulty.EXPERT]: 60,
};
```

Prices come from `economy_config`; a bundled copy would silently drift from the server's real values.

- [ ] **Step 5: Remove the dead per-letter helper**

In `services/hintEngine.ts`, delete `getRevealWordCost` — nothing calls it once the modal uses the flat price. Keep `getUnrevealedLetterCount`, which `canRevealWord` still uses to decide availability.

- [ ] **Step 6: Typecheck and test**

Run: `npx tsc --noEmit` — expected clean.
Run: `npx jest` — expected all pass.

- [ ] **Step 7: Commit**

```bash
git add components/modals/HintOptionsModal.tsx types/puzzle.types.ts services/hintEngine.ts
git commit -m "feat(client): flat word-hint price; remove bundled ENTRY_FEES"
```

---

### Task 7: Free plays on the home screen

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `getPlayStatus` (Task 4).

- [ ] **Step 1: Load play status**

Alongside the other hooks:

```ts
  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  useEffect(() => {
    getPlayStatus().then(setPlayStatus).catch(() => setPlayStatus(null));
  }, [profile.id]);
```

Import `getPlayStatus` and `PlayStatus` from `../../services/economyService`.

- [ ] **Step 2: Add a free-plays chip to the stats pill**

After the coins group in `styles.statsPill`:

```tsx
            <View style={styles.statDivider} />
            <View style={styles.statGroup}>
              <MaterialIcons
                name="bolt"
                size={18}
                color={theme.colors.accentGold}
              />
              <Text style={styles.statText}>
                {playStatus ? playStatus.free_plays_remaining : "–"}
              </Text>
            </View>
```

- [ ] **Step 3: Show the completion message when the allowance is gone**

Below the daily-bonus banner, render only when the allowance is exhausted:

```tsx
        {playStatus?.free_plays_remaining === 0 && (
          <View style={styles.setCompleteBanner}>
            <MaterialIcons
              name="check-circle"
              size={20}
              color={theme.colors.accentGold}
            />
            <Text style={styles.setCompleteText}>
              You&apos;ve finished today&apos;s set — new puzzles at midnight.
              Keep going any time by spending coins.
            </Text>
          </View>
        )}
```

```ts
  setCompleteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(238, 205, 43, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  setCompleteText: {
    flex: 1,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
```

The copy is a completion, not a wall — that framing is fixed by the spec and is the difference between a good review and a bad one.

- [ ] **Step 4: Verify on device**

Run: `npx expo run:android`

Expected: the home screen shows 3 free plays. Solve three category puzzles and it drops to 0 and the completion banner appears. The daily challenge does not decrement it. Starting a fourth category puzzle deducts the overflow fee. Re-opening any started puzzle is free.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat(client): show remaining free plays and today's-set-complete state"
```

---

## Done criteria

1. `npx jest` passes, including all integration suites.
2. A new user receives 300 coins.
3. Three category puzzles per UTC day are free; the fourth charges the overflow fee.
4. The daily challenge is free and does not decrement the allowance.
5. Re-entering a started puzzle never charges.
6. An entry refused for insufficient coins leaves no `puzzle_entries` row.
7. A word reveal costs exactly 120 at any word length, and records 4 letters of penalty.
8. `spend_on_hint` rejects a `p_letter_count` argument.
9. `ENTRY_FEES` no longer exists in the codebase.
10. `SELECT SUM(delta) FROM coin_ledger WHERE user_id = X` equals `users.coins`.

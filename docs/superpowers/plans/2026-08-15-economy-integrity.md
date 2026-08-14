# Economy Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Cruxe's currency, scores, and purchase grants from client-authoritative to server-authoritative, so coins cannot be forged, scores cannot be reported by the client, and a completed purchase always results in exactly one coin grant.

**Architecture:** An append-only `coin_ledger` in Postgres is the financial truth; every movement passes through one row-locked, idempotent `SECURITY DEFINER` function. Solve verification runs in a Deno Edge Function that imports the same scoring module the React Native client uses, so client preview and server truth cannot drift. Client write access to `users` and `puzzle_completions` is revoked entirely.

**Tech Stack:** Expo 54 / React Native 0.81, TypeScript, Zustand, Supabase (Postgres + Edge Functions/Deno), RevenueCat, Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-08-15-economy-integrity-design.md`

## Global Constraints

- **No client may send a coin amount, price, or score.** Every economic quantity is derived server-side from `economy_config`, `coin_products`, or the stored puzzle. The single exception is `spend_on_hint`'s `letter_count`, which the server clamps to `[1, clue_length]`.
- **Every ledger movement is idempotent.** Key conventions are fixed: `welcome:{user_id}`, `solve:{user_id}:{puzzle_id}`, `entry:{user_id}:{puzzle_id}`, `daily:{user_id}:{YYYY-MM-DD}`, `hint:{action_id}`, `rc:{event_id}`, `rc_refund:{event_id}`.
- **This project changes no economic number.** All seeded values must equal today's constants exactly: welcome 200; entry fees easy/medium/hard/expert 5/15/30/60; solve rewards 10/25/50/100; reveal letter 30, reveal word 30 per letter, check errors 20 with 5 free; daily bonus `min(50, 15 + 5 × streak)`; scoring bases 80/180/320/500, grid multipliers 0.7/0.85/1.0/1.2, time factors 3.0/4.5/7.0/10.0, hint penalty 8, minimum scores 5/10/20/40.
- **Scoring logic exists in exactly one file:** `supabase/functions/_shared/scoring.ts`. `services/scoreEngine.ts` becomes a re-export. Never copy the formula.
- **Migrations are numbered sequentially** from the existing `004_fix_completions_rls.sql`.
- **Target platform is mobile.** Do not add Node-only APIs to files imported by the React Native client.
- All new SQL functions declare `set search_path = public`.

## Test Strategy

Two layers, both runnable on Windows without Docker:

- **Unit (Jest + ts-jest):** pure TypeScript — scoring, grid verification, canonical cell ordering.
- **Integration (Jest against a real Supabase dev project):** SQL functions and RLS, driven through `@supabase/supabase-js` with the service role key. Reads `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` from the environment; the whole suite is skipped with a clear message when they are unset, so unit tests still run in CI without secrets.

Integration tests must clean up after themselves — each creates its own user via `auth.admin.createUser` and deletes it in `afterEach`.

## File Structure

**Created — database**
- `supabase/migrations/005_economy_schema.sql` — new tables, `users` alterations, seeds
- `supabase/migrations/006_ledger_core.sql` — `ledger_apply`
- `supabase/migrations/007_economy_rpcs.sql` — player RPCs and service-role RPCs
- `supabase/migrations/008_lockdown_and_leaderboard.sql` — grants, policies, `auth.users` trigger, `get_leaderboard`, `puzzle_stats` trigger
- `supabase/migrations/009_completions_uuid.sql` — `puzzle_completions.user_id` to UUID

**Created — shared (imported by both Deno and Metro)**
- `supabase/functions/_shared/scoring.ts` — canonical scoring, config-driven
- `supabase/functions/_shared/grid.ts` — grid types, canonical cell ordering, verification
- `supabase/functions/_shared/economyTypes.ts` — `economy_config` value shapes

**Created — Edge Functions**
- `supabase/functions/submit-solve/index.ts`
- `supabase/functions/revenuecat-webhook/index.ts`
- `supabase/functions/sync-purchases/index.ts`
- `supabase/functions/delete-account/index.ts`

**Created — client**
- `services/economyService.ts` — typed wrappers over every economy RPC and Edge Function
- `services/analyticsService.ts` — event funnel

**Modified — client**
- `services/scoreEngine.ts` — becomes a re-export of the shared module
- `services/puzzleService.ts` — `recordCompletion` deleted; reads stored grids; player count from `puzzle_stats`
- `services/authService.ts` — `ensureUserProfile` deleted
- `stores/userStore.ts` — coin mutations removed; balance becomes a server mirror
- `components/modals/HintOptionsModal.tsx` — charge before reveal, via RPC
- `app/game/[puzzleId].tsx` — submits to `submit-solve`
- `app/(tabs)/store.tsx` — no client grant; realtime ledger
- `app/(tabs)/index.tsx`, `app/category/[id].tsx`, `app/collection/index.tsx`, `app/(tabs)/profile.tsx`
- `scripts/generate-daily-puzzles-free.ts` — builds and stores grids

---

### Task 1: Test infrastructure and the shared scoring module

Establishes the test runner the whole plan depends on, and relocates scoring to its single canonical home.

**Files:**
- Create: `supabase/functions/_shared/economyTypes.ts`
- Create: `supabase/functions/_shared/scoring.ts`
- Create: `__tests__/scoring.test.ts`
- Create: `jest.config.js`
- Modify: `services/scoreEngine.ts` (replace entire contents)
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `calculateScore(params: ScoreParams, config: ScoringConfig): ScoreBreakdown`, `getTheoreticalMax(difficulty, gridSize, config): number`, `DEFAULT_SCORING_CONFIG: ScoringConfig`, and the `ScoringConfig` / `ScoreParams` / `ScoreBreakdown` types. Tasks 9 and 13 import these.

- [ ] **Step 1: Install test dependencies**

```bash
npm install --save-dev jest@^29 ts-jest@^29 @types/jest@^29
```

- [ ] **Step 2: Create `jest.config.js`**

```js
/** @type {import('ts-jest').JestConfigWithTSJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
};
```

- [ ] **Step 3: Add test scripts to `package.json`**

Add to the `scripts` object:

```json
"test": "jest",
"test:unit": "jest --testPathIgnorePatterns integration",
"test:integration": "jest __tests__/integration"
```

- [ ] **Step 4: Write the failing test**

Create `__tests__/scoring.test.ts`:

```ts
import {
  calculateScore,
  getTheoreticalMax,
  DEFAULT_SCORING_CONFIG as CFG,
} from "../supabase/functions/_shared/scoring";

describe("calculateScore", () => {
  it("awards the theoretical max for a perfect, blazing, hint-free solve", () => {
    // medium base 180 x grid 1.0 = 180; time 1.4 => 252
    const r = calculateScore(
      { difficulty: "medium", gridSize: 10, accuracy: 1, timeTaken: 10, hintsUsed: 0 },
      CFG,
    );
    expect(r.finalScore).toBe(252);
    expect(r.grade).toBe("S");
  });

  it("subtracts 8 per hint", () => {
    const r = calculateScore(
      { difficulty: "medium", gridSize: 10, accuracy: 1, timeTaken: 10, hintsUsed: 3 },
      CFG,
    );
    expect(r.hintPenalty).toBe(24);
    expect(r.finalScore).toBe(228);
  });

  it("never returns less than the difficulty minimum", () => {
    const r = calculateScore(
      { difficulty: "expert", gridSize: 12, accuracy: 0.1, timeTaken: 99999, hintsUsed: 50 },
      CFG,
    );
    expect(r.finalScore).toBe(40);
  });

  it("caps at the theoretical max even with absurd inputs", () => {
    const r = calculateScore(
      { difficulty: "easy", gridSize: 6, accuracy: 1, timeTaken: 0, hintsUsed: 0 },
      CFG,
    );
    expect(r.finalScore).toBe(getTheoreticalMax("easy", 6, CFG));
  });

  it("matches the legacy expert 12x12 ceiling of 840", () => {
    expect(getTheoreticalMax("expert", 12, CFG)).toBe(840);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx jest __tests__/scoring.test.ts`
Expected: FAIL — cannot find module `../supabase/functions/_shared/scoring`.

- [ ] **Step 6: Create `supabase/functions/_shared/economyTypes.ts`**

```ts
/** Value shapes stored in the economy_config table. Shared by Deno and Metro. */

export type Difficulty = "easy" | "medium" | "hard" | "expert";
export type GridSize = 6 | 8 | 10 | 12;

export interface ScoringConfig {
  difficultyBase: Record<Difficulty, number>;
  gridMultiplier: Record<GridSize, number>;
  timeFactor: Record<Difficulty, number>;
  hintPenaltyPerLetter: number;
  minimumScore: Record<Difficulty, number>;
  /** Ordered fastest-first. Ratio is actualTime / expectedTime. */
  timeMultipliers: { maxRatio: number; multiplier: number }[];
}

export interface HintPrices {
  reveal_letter: number;
  reveal_word_per_letter: number;
  check_errors: number;
  free_checks_count: number;
}

export interface TimeBounds {
  /** Floor seconds = cells x perCell + words x perWord. */
  floorPerCellSeconds: number;
  floorPerWordSeconds: number;
  ceilingSeconds: number;
}
```

- [ ] **Step 7: Create `supabase/functions/_shared/scoring.ts`**

This is the existing `services/scoreEngine.ts` formula with its constants lifted into a config parameter. The arithmetic is unchanged.

```ts
import {
  Difficulty,
  GridSize,
  ScoringConfig,
} from "./economyTypes";

export interface ScoreParams {
  difficulty: Difficulty;
  gridSize: GridSize;
  /** Ratio of correctly filled cells to total fillable cells (0-1) */
  accuracy: number;
  timeTaken: number;
  hintsUsed: number;
}

export interface ScoreBreakdown {
  base: number;
  accuracyMultiplier: number;
  timeMultiplier: number;
  hintPenalty: number;
  finalScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
}

/** Mirrors the values seeded into economy_config. Used as an offline display
 *  fallback only — a charge or an awarded score always uses the DB config. */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  difficultyBase: { easy: 80, medium: 180, hard: 320, expert: 500 },
  gridMultiplier: { 6: 0.7, 8: 0.85, 10: 1.0, 12: 1.2 },
  timeFactor: { easy: 3.0, medium: 4.5, hard: 7.0, expert: 10.0 },
  hintPenaltyPerLetter: 8,
  minimumScore: { easy: 5, medium: 10, hard: 20, expert: 40 },
  timeMultipliers: [
    { maxRatio: 0.5, multiplier: 1.4 },
    { maxRatio: 0.75, multiplier: 1.2 },
    { maxRatio: 1.0, multiplier: 1.0 },
    { maxRatio: 1.3, multiplier: 0.85 },
    { maxRatio: 1.75, multiplier: 0.7 },
    { maxRatio: Infinity, multiplier: 0.55 },
  ],
};

function resolveTimeMultiplier(ratio: number, cfg: ScoringConfig): number {
  for (const band of cfg.timeMultipliers) {
    if (ratio <= band.maxRatio) return band.multiplier;
  }
  return cfg.timeMultipliers[cfg.timeMultipliers.length - 1].multiplier;
}

function resolveGrade(
  finalScore: number,
  theoreticalMax: number,
): ScoreBreakdown["grade"] {
  if (theoreticalMax <= 0) return "C";
  const ratio = finalScore / theoreticalMax;
  if (ratio >= 0.9) return "S";
  if (ratio >= 0.75) return "A";
  if (ratio >= 0.55) return "B";
  if (ratio >= 0.35) return "C";
  return "D";
}

export function getTheoreticalMax(
  difficulty: Difficulty,
  gridSize: GridSize,
  cfg: ScoringConfig,
): number {
  const base = Math.round(
    cfg.difficultyBase[difficulty] * cfg.gridMultiplier[gridSize],
  );
  const fastest = cfg.timeMultipliers[0].multiplier;
  return Math.floor(base * fastest);
}

export function calculateScore(
  params: ScoreParams,
  cfg: ScoringConfig,
): ScoreBreakdown {
  const { difficulty, gridSize, accuracy, timeTaken, hintsUsed } = params;

  const base = Math.round(
    cfg.difficultyBase[difficulty] * cfg.gridMultiplier[gridSize],
  );
  const accuracyMultiplier = Math.min(1, Math.max(0, accuracy));

  const expectedTime = gridSize * gridSize * cfg.timeFactor[difficulty];
  const timeRatio = timeTaken / Math.max(1, expectedTime);
  const timeMultiplier = resolveTimeMultiplier(timeRatio, cfg);

  const hintPenalty = hintsUsed * cfg.hintPenaltyPerLetter;

  const raw =
    Math.floor(base * accuracyMultiplier * timeMultiplier) - hintPenalty;
  const theoreticalMax = getTheoreticalMax(difficulty, gridSize, cfg);
  const finalScore = Math.max(
    cfg.minimumScore[difficulty],
    Math.min(raw, theoreticalMax),
  );

  return {
    base,
    accuracyMultiplier,
    timeMultiplier,
    hintPenalty,
    finalScore,
    grade: resolveGrade(finalScore, theoreticalMax),
  };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx jest __tests__/scoring.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 9: Replace `services/scoreEngine.ts` with a re-export**

Replace the entire file contents:

```ts
/**
 * scoreEngine.ts — Client-facing re-export of the canonical scoring module.
 *
 * The formula lives at supabase/functions/_shared/scoring.ts so the Edge
 * Function that awards scores and the client that previews them cannot drift.
 * Do not add logic here.
 */
export {
  calculateScore,
  getTheoreticalMax,
  DEFAULT_SCORING_CONFIG,
} from "../supabase/functions/_shared/scoring";
export type {
  ScoreParams,
  ScoreBreakdown,
} from "../supabase/functions/_shared/scoring";
```

- [ ] **Step 10: Verify the app still typechecks**

Run: `npx tsc --noEmit`
Expected: no errors from `scoreEngine` or its importers. `app/game/[puzzleId].tsx` calls `calculateScore` with one argument and will now error — that is expected and is fixed in Task 13. Note the error and continue.

- [ ] **Step 11: Commit**

```bash
git add jest.config.js package.json package-lock.json __tests__/scoring.test.ts supabase/functions/_shared/ services/scoreEngine.ts
git commit -m "test: add jest; move scoring to shared config-driven module"
```

---

### Task 2: Economy schema migration

**Files:**
- Create: `supabase/migrations/005_economy_schema.sql`

**Interfaces:**
- Produces: tables `coin_ledger`, `hint_events`, `economy_config`, `coin_products`, `iap_events`, `puzzle_stats`; enum `coin_reason`; `users.last_daily_bonus_date`. Every later task depends on these.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Cruxe Migration 005: Economy schema
-- Server-authoritative currency. See
-- docs/superpowers/specs/2026-08-15-economy-integrity-design.md
-- ============================================================

CREATE TYPE coin_reason AS ENUM (
  'welcome_bonus','daily_bonus','solve_reward','entry_fee',
  'hint_reveal_letter','hint_reveal_word','hint_check_errors',
  'iap_purchase','refund','admin_adjust'
);

-- Append-only financial truth. users.coins is the materialised balance.
CREATE TABLE coin_ledger (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta           INT  NOT NULL CHECK (delta <> 0),
  reason          coin_reason NOT NULL,
  balance_after   INT  NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ledger_user ON coin_ledger (user_id, created_at DESC);

-- Hint usage, including free actions that move no money.
-- submit_solve derives the hint penalty from here, never from the client.
CREATE TABLE hint_events (
  id                     BIGSERIAL PRIMARY KEY,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id              UUID NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  hint_type              TEXT NOT NULL
                           CHECK (hint_type IN ('reveal_letter','reveal_word','check_errors')),
  cost                   INT  NOT NULL DEFAULT 0,
  letters_revealed       INT  NOT NULL DEFAULT 0,
  reported_letter_count  INT,
  action_id              UUID NOT NULL UNIQUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hint_events_user_puzzle ON hint_events (user_id, puzzle_id);

-- Runtime-authoritative economy constants. Seeded here; git is the source of truth.
CREATE TABLE economy_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  version    INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store SKU -> coin amount. Replaces the client-side regex.
CREATE TABLE coin_products (
  product_id    TEXT PRIMARY KEY,
  coins         INT  NOT NULL CHECK (coins > 0),
  display_name  TEXT NOT NULL,
  bonus_percent INT  NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- Raw purchase events for audit, reconciliation, and replay detection.
CREATE TABLE iap_events (
  event_id   TEXT PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id TEXT,
  event_type TEXT NOT NULL,
  is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public per-puzzle aggregates. Replaces reading puzzle_completions directly.
CREATE TABLE puzzle_stats (
  puzzle_id         UUID PRIMARY KEY REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  players_completed INT NOT NULL DEFAULT 0,
  avg_score         NUMERIC,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users alterations
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_bonus_date DATE;
CREATE INDEX IF NOT EXISTS idx_users_total_score ON users (total_score DESC);

-- puzzle_completions: retain the raw client time claim next to the clamped one
ALTER TABLE puzzle_completions
  ADD COLUMN IF NOT EXISTS suspect BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reported_time_seconds INT;

-- ============================================================
-- SEEDS — values must equal the pre-migration client constants exactly.
-- ============================================================

INSERT INTO economy_config (key, value) VALUES
  ('welcome_bonus', '{"coins": 200}'::JSONB),
  ('daily_bonus',   '{"base": 15, "per_streak_day": 5, "cap": 50}'::JSONB),
  ('entry_fees',    '{"easy": 5, "medium": 15, "hard": 30, "expert": 60}'::JSONB),
  ('solve_rewards', '{"easy": 10, "medium": 25, "hard": 50, "expert": 100}'::JSONB),
  ('hint_prices',   '{"reveal_letter": 30, "reveal_word_per_letter": 30,
                      "check_errors": 20, "free_checks_count": 5}'::JSONB),
  ('leaderboard',   '{"min_puzzles_solved": 3}'::JSONB),
  ('time_bounds',   '{"floorPerCellSeconds": 0.35, "floorPerWordSeconds": 1.5,
                      "ceilingSeconds": 21600}'::JSONB),
  ('scoring', '{
      "difficultyBase": {"easy": 80, "medium": 180, "hard": 320, "expert": 500},
      "gridMultiplier": {"6": 0.7, "8": 0.85, "10": 1.0, "12": 1.2},
      "timeFactor": {"easy": 3.0, "medium": 4.5, "hard": 7.0, "expert": 10.0},
      "hintPenaltyPerLetter": 8,
      "minimumScore": {"easy": 5, "medium": 10, "hard": 20, "expert": 40},
      "timeMultipliers": [
        {"maxRatio": 0.5,  "multiplier": 1.4},
        {"maxRatio": 0.75, "multiplier": 1.2},
        {"maxRatio": 1.0,  "multiplier": 1.0},
        {"maxRatio": 1.3,  "multiplier": 0.85},
        {"maxRatio": 1.75, "multiplier": 0.7},
        {"maxRatio": 1e12, "multiplier": 0.55}
      ]
    }'::JSONB)
ON CONFLICT (key) DO NOTHING;
```

> `Infinity` is not valid JSON, so the final time band uses `1e12`. `resolveTimeMultiplier` iterates in order and falls back to the last band, so behaviour is identical.

- [ ] **Step 2: Apply the migration**

Paste the file into the Supabase SQL Editor (Dashboard → SQL Editor) and run it, or `supabase db push` if the CLI is linked.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Verify the seeds landed**

Run in the SQL editor:

```sql
SELECT key, jsonb_pretty(value) FROM economy_config ORDER BY key;
```

Expected: 8 rows. Confirm `scoring -> difficultyBase -> expert` is `500` and `entry_fees -> medium` is `15`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_economy_schema.sql
git commit -m "feat(db): economy schema, config seeds, and stats tables"
```

---

### Task 3: `ledger_apply` — the one function that moves money

**Files:**
- Create: `supabase/migrations/006_ledger_core.sql`
- Create: `__tests__/integration/setup.ts`
- Create: `__tests__/integration/ledger.test.ts`

**Interfaces:**
- Consumes: Task 2's `coin_ledger`, `coin_reason`.
- Produces: `ledger_apply(p_user_id uuid, p_delta int, p_reason coin_reason, p_idempotency_key text, p_metadata jsonb, p_allow_negative boolean) RETURNS int` (the new balance). Every economic RPC in Tasks 4 and 5 calls it.

- [ ] **Step 1: Write the integration test harness**

Create `__tests__/integration/setup.ts`:

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

export const hasTestEnv = Boolean(url && key);

/** Skips the whole suite with a clear reason when test credentials are absent. */
export const describeIntegration = hasTestEnv
  ? describe
  : describe.skip;

export function serviceClient(): SupabaseClient {
  if (!hasTestEnv) throw new Error("Missing SUPABASE_TEST_* env vars");
  return createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Creates a throwaway auth user. The auth trigger (Task 6) creates the
 *  profile row; before that task exists, tests insert it explicitly. */
export async function createTestUser(db: SupabaseClient): Promise<string> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@cruxe.test`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "test-password-123",
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

export async function deleteTestUser(db: SupabaseClient, id: string) {
  await db.auth.admin.deleteUser(id);
}
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/integration/ledger.test.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestUser,
  deleteTestUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("ledger_apply", () => {
  let db: SupabaseClient;
  let userId: string;

  beforeAll(() => {
    db = serviceClient();
  });

  beforeEach(async () => {
    userId = await createTestUser(db);
    await db.from("users").upsert({ id: userId, coins: 0 });
  });

  afterEach(async () => {
    await deleteTestUser(db, userId);
  });

  const apply = (delta: number, reason: string, key: string, allowNeg = false) =>
    db.rpc("ledger_apply", {
      p_user_id: userId,
      p_delta: delta,
      p_reason: reason,
      p_idempotency_key: key,
      p_metadata: {},
      p_allow_negative: allowNeg,
    });

  it("credits and returns the new balance", async () => {
    const { data, error } = await apply(200, "welcome_bonus", `w:${userId}`);
    expect(error).toBeNull();
    expect(data).toBe(200);
  });

  it("is idempotent — the same key applies once", async () => {
    await apply(200, "welcome_bonus", `w:${userId}`);
    const { data } = await apply(200, "welcome_bonus", `w:${userId}`);
    expect(data).toBe(200);

    const { count } = await db
      .from("coin_ledger")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(1);
  });

  it("refuses to overdraw", async () => {
    await apply(50, "welcome_bonus", `w:${userId}`);
    const { error } = await apply(-80, "entry_fee", `e:${userId}`);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("insufficient_coins");

    const { data: row } = await db
      .from("users").select("coins").eq("id", userId).single();
    expect(row!.coins).toBe(50);
  });

  it("allows refunds to drive the balance negative", async () => {
    await apply(100, "iap_purchase", `p:${userId}`);
    await apply(-100, "entry_fee", `e:${userId}`);
    const { data } = await apply(-100, "refund", `r:${userId}`, true);
    expect(data).toBe(-100);
  });

  it("serialises concurrent debits without overdrawing", async () => {
    await apply(100, "welcome_bonus", `w:${userId}`);
    const results = await Promise.all([
      apply(-60, "hint_reveal_letter", `h1:${userId}`),
      apply(-60, "hint_reveal_letter", `h2:${userId}`),
    ]);
    const failures = results.filter((r) => r.error !== null);
    expect(failures).toHaveLength(1);

    const { data: row } = await db
      .from("users").select("coins").eq("id", userId).single();
    expect(row!.coins).toBe(40);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
export SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_ROLE_KEY=...
npx jest __tests__/integration/ledger.test.ts
```
Expected: FAIL — `Could not find the function public.ledger_apply`.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/006_ledger_core.sql`:

```sql
-- ============================================================
-- Cruxe Migration 006: ledger_apply
-- The single point through which every coin movement passes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ledger_apply(
  p_user_id         UUID,
  p_delta           INT,
  p_reason          coin_reason,
  p_idempotency_key TEXT,
  p_metadata        JSONB   DEFAULT '{}'::JSONB,
  p_allow_negative  BOOLEAN DEFAULT FALSE
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing INT;
  v_balance  INT;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'delta_must_be_nonzero';
  END IF;

  -- Fast path: this movement already happened.
  SELECT balance_after INTO v_existing
    FROM coin_ledger WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Serialise concurrent movements for this user.
  SELECT coins INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  v_balance := v_balance + p_delta;
  IF v_balance < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  UPDATE users SET coins = v_balance WHERE id = p_user_id;

  INSERT INTO coin_ledger (user_id, delta, reason, balance_after,
                           idempotency_key, metadata)
  VALUES (p_user_id, p_delta, p_reason, v_balance,
          p_idempotency_key, p_metadata);

  RETURN v_balance;

EXCEPTION
  -- Two callers raced past the fast path with the same key. The losing
  -- transaction rolls back to the start of this block, undoing its UPDATE,
  -- then reports the winner's balance.
  WHEN unique_violation THEN
    SELECT balance_after INTO v_existing
      FROM coin_ledger WHERE idempotency_key = p_idempotency_key;
    RETURN v_existing;
END;
$$;

-- Never callable by clients. Only SECURITY DEFINER functions and service_role.
REVOKE ALL ON FUNCTION public.ledger_apply(UUID, INT, coin_reason, TEXT, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 5: Apply the migration and rerun the tests**

Run the SQL in the Supabase SQL Editor, then:
`npx jest __tests__/integration/ledger.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/006_ledger_core.sql __tests__/integration/
git commit -m "feat(db): row-locked idempotent ledger_apply with tests"
```

---

### Task 4: Player-facing economy RPCs

**Files:**
- Create: `supabase/migrations/007_economy_rpcs.sql`
- Create: `__tests__/integration/playerRpcs.test.ts`

**Interfaces:**
- Consumes: `ledger_apply` (Task 3), `economy_config` (Task 2).
- Produces, all resolving the caller from `auth.uid()`:
  - `spend_on_hint(p_puzzle_id uuid, p_hint_type text, p_action_id uuid, p_letter_count int) RETURNS jsonb` → `{balance, cost, replayed}`
  - `pay_entry_fee(p_puzzle_id uuid) RETURNS jsonb` → `{balance, fee, replayed}`
  - `claim_daily_bonus() RETURNS jsonb` → `{bonus, streak, balance, already_claimed}`
  - `set_display_name(p_name text) RETURNS jsonb` → `{display_name}`

- [ ] **Step 1: Write the failing test**

Create `__tests__/integration/playerRpcs.test.ts`. These call as an authenticated user, not the service role, so the harness signs a user in.

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { describeIntegration, serviceClient } from "./setup";

describeIntegration("player economy RPCs", () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let puzzleId: string;
  const email = () => `t-${Date.now()}-${Math.random().toString(36).slice(2)}@cruxe.test`;

  beforeAll(async () => {
    admin = serviceClient();
    const { data: p } = await admin
      .from("daily_puzzles")
      .select("id")
      .eq("difficulty", "medium")
      .limit(1)
      .single();
    puzzleId = p!.id;
  });

  beforeEach(async () => {
    const addr = email();
    const { data } = await admin.auth.admin.createUser({
      email: addr, password: "test-password-123", email_confirm: true,
    });
    userId = data.user!.id;
    await admin.from("users").upsert({ id: userId, coins: 500, current_streak: 2 });

    user = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    await user.auth.signInWithPassword({ email: addr, password: "test-password-123" });
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
  });

  it("charges the configured reveal_letter price, not a client price", async () => {
    const { data, error } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_letter",
      p_action_id: crypto.randomUUID(),
      p_letter_count: 1,
    });
    expect(error).toBeNull();
    expect(data.cost).toBe(30);
    expect(data.balance).toBe(470);
  });

  it("prices reveal_word per letter and clamps an inflated count", async () => {
    const { data } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_word",
      p_action_id: crypto.randomUUID(),
      p_letter_count: 9999,
    });
    // Clamped to the longest clue in the puzzle, so cost stays sane.
    expect(data.cost).toBeLessThanOrEqual(30 * 12);
    expect(data.cost).toBeGreaterThan(0);
  });

  it("replays a hint action_id without double-charging", async () => {
    const action = crypto.randomUUID();
    const a = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId, p_hint_type: "reveal_letter",
      p_action_id: action, p_letter_count: 1,
    });
    const b = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId, p_hint_type: "reveal_letter",
      p_action_id: action, p_letter_count: 1,
    });
    expect(a.data.balance).toBe(470);
    expect(b.data.balance).toBe(470);
    expect(b.data.replayed).toBe(true);
  });

  it("gives the first five error checks free, then charges", async () => {
    for (let i = 0; i < 5; i++) {
      const { data } = await user.rpc("spend_on_hint", {
        p_puzzle_id: puzzleId, p_hint_type: "check_errors",
        p_action_id: crypto.randomUUID(), p_letter_count: 0,
      });
      expect(data.cost).toBe(0);
    }
    const { data } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId, p_hint_type: "check_errors",
      p_action_id: crypto.randomUUID(), p_letter_count: 0,
    });
    expect(data.cost).toBe(20);
  });

  it("charges the entry fee for the puzzle's own difficulty", async () => {
    const { data } = await user.rpc("pay_entry_fee", { p_puzzle_id: puzzleId });
    expect(data.fee).toBe(15);
    expect(data.balance).toBe(485);
  });

  it("pays a streak-scaled daily bonus once per day", async () => {
    const first = await user.rpc("claim_daily_bonus");
    expect(first.data.bonus).toBe(25); // 15 + 5 x streak 2
    const second = await user.rpc("claim_daily_bonus");
    expect(second.data.already_claimed).toBe(true);
    expect(second.data.bonus).toBe(0);
  });

  it("rejects a display name that is too short or has bad characters", async () => {
    const bad = await user.rpc("set_display_name", { p_name: "a" });
    expect(bad.error).not.toBeNull();
    const ok = await user.rpc("set_display_name", { p_name: "Sam C" });
    expect(ok.data.display_name).toBe("Sam C");
  });

  it("cannot write users.coins directly", async () => {
    const { error } = await user.from("users").update({ coins: 999999 }).eq("id", userId);
    expect(error).not.toBeNull();
  });
});
```

> The last assertion depends on Task 6's grant revocation and will fail until then. That is intentional — it is the regression test for the core vulnerability. Mark it `it.failing` if executing tasks strictly in order, and flip it back in Task 6.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/integration/playerRpcs.test.ts`
Expected: FAIL — `Could not find the function public.spend_on_hint`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/007_economy_rpcs.sql`:

```sql
-- ============================================================
-- Cruxe Migration 007: player-facing economy RPCs
-- The client never sends a price. Every amount is derived here.
-- ============================================================

-- ---------- spend_on_hint ----------
CREATE OR REPLACE FUNCTION public.spend_on_hint(
  p_puzzle_id    UUID,
  p_hint_type    TEXT,
  p_action_id    UUID,
  p_letter_count INT DEFAULT 1
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_prices     JSONB;
  v_cost       INT;
  v_reason     coin_reason;
  v_balance    INT;
  v_used_free  INT;
  v_max_len    INT;
  v_letters    INT := 0;
  v_prior      INT;
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

  IF p_hint_type = 'reveal_letter' THEN
    v_cost    := (v_prices->>'reveal_letter')::INT;
    v_reason  := 'hint_reveal_letter';
    v_letters := 1;

  ELSIF p_hint_type = 'reveal_word' THEN
    -- The client knows how many letters remain; the server bounds the claim
    -- by the longest clue actually in this puzzle.
    SELECT COALESCE(MAX((c->>'length')::INT), 1) INTO v_max_len
      FROM daily_puzzles d,
           LATERAL jsonb_array_elements(d.puzzle_data->'clues') c
     WHERE d.id = p_puzzle_id;

    v_letters := LEAST(GREATEST(COALESCE(p_letter_count, 1), 1),
                       COALESCE(v_max_len, 1));
    v_cost    := (v_prices->>'reveal_word_per_letter')::INT * v_letters;
    v_reason  := 'hint_reveal_word';

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
      jsonb_build_object('puzzle_id', p_puzzle_id, 'hint_type', p_hint_type)
    );
  ELSE
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
  END IF;

  INSERT INTO hint_events (user_id, puzzle_id, hint_type, cost,
                           letters_revealed, reported_letter_count, action_id)
  VALUES (v_user, p_puzzle_id, p_hint_type, v_cost,
          v_letters, p_letter_count, p_action_id);

  RETURN jsonb_build_object('balance', v_balance, 'cost', v_cost,
                            'replayed', FALSE);
END;
$$;

-- ---------- pay_entry_fee ----------
CREATE OR REPLACE FUNCTION public.pay_entry_fee(p_puzzle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_difficulty TEXT;
  v_fee        INT;
  v_balance    INT;
  v_key        TEXT;
  v_existing   INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT difficulty INTO v_difficulty FROM daily_puzzles WHERE id = p_puzzle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'puzzle_not_found'; END IF;

  SELECT (value->>v_difficulty)::INT INTO v_fee
    FROM economy_config WHERE key = 'entry_fees';

  v_key := 'entry:' || v_user::TEXT || ':' || p_puzzle_id::TEXT;

  -- Paying twice for the same puzzle is free; the key already exists.
  SELECT balance_after INTO v_existing
    FROM coin_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object('balance', v_balance, 'fee', 0, 'replayed', TRUE);
  END IF;

  v_balance := ledger_apply(v_user, -v_fee, 'entry_fee', v_key,
                            jsonb_build_object('puzzle_id', p_puzzle_id));

  RETURN jsonb_build_object('balance', v_balance, 'fee', v_fee,
                            'replayed', FALSE);
END;
$$;

-- ---------- claim_daily_bonus ----------
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_today   DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_last    DATE;
  v_streak  INT;
  v_cfg     JSONB;
  v_bonus   INT;
  v_balance INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT last_daily_bonus_date, current_streak, coins
    INTO v_last, v_streak, v_balance
    FROM users WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF v_last = v_today THEN
    RETURN jsonb_build_object('bonus', 0, 'streak', v_streak,
                              'balance', v_balance, 'already_claimed', TRUE);
  END IF;

  SELECT value INTO v_cfg FROM economy_config WHERE key = 'daily_bonus';
  v_bonus := LEAST(
    (v_cfg->>'cap')::INT,
    (v_cfg->>'base')::INT + COALESCE(v_streak, 0) * (v_cfg->>'per_streak_day')::INT
  );

  v_balance := ledger_apply(
    v_user, v_bonus, 'daily_bonus',
    'daily:' || v_user::TEXT || ':' || v_today::TEXT,
    jsonb_build_object('streak', v_streak)
  );

  UPDATE users SET last_daily_bonus_date = v_today WHERE id = v_user;

  RETURN jsonb_build_object('bonus', v_bonus, 'streak', v_streak,
                            'balance', v_balance, 'already_claimed', FALSE);
END;
$$;

-- ---------- set_display_name ----------
CREATE OR REPLACE FUNCTION public.set_display_name(p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_clean TEXT := TRIM(p_name);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF LENGTH(v_clean) < 2 OR LENGTH(v_clean) > 20 THEN
    RAISE EXCEPTION 'display_name_length';
  END IF;
  -- Letters, digits, spaces, hyphen, underscore, apostrophe.
  IF v_clean !~ '^[A-Za-z0-9 _''-]+$' THEN
    RAISE EXCEPTION 'display_name_charset';
  END IF;
  IF v_clean ~* '(fuck|shit|cunt|nigg|faggot|rape)' THEN
    RAISE EXCEPTION 'display_name_rejected';
  END IF;

  UPDATE users SET display_name = v_clean WHERE id = v_user;
  RETURN jsonb_build_object('display_name', v_clean);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_on_hint(UUID, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_entry_fee(UUID)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_display_name(TEXT)               TO authenticated;
```

> The profanity check is a deliberately small stop-list, not a content-moderation system. It blocks the obvious cases at zero cost; a real filter belongs with the moderation work in sub-project 6.

- [ ] **Step 4: Apply and rerun**

Run the SQL, then `npx jest __tests__/integration/playerRpcs.test.ts`.
Expected: PASS for all but the final `cannot write users.coins` assertion, which requires Task 6.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_economy_rpcs.sql __tests__/integration/playerRpcs.test.ts
git commit -m "feat(db): server-priced hint, entry fee, daily bonus, display name RPCs"
```

---

### Task 5: `submit_solve` and `credit_purchase`

**Files:**
- Modify: `supabase/migrations/007_economy_rpcs.sql` (append)
- Create: `__tests__/integration/submitSolve.test.ts`

**Interfaces:**
- Consumes: `ledger_apply`.
- Produces:
  - `submit_solve(p_user_id uuid, p_puzzle_id uuid, p_accuracy real, p_time_seconds int, p_reported_time int, p_hints_used int, p_score int, p_suspect boolean) RETURNS jsonb` → `{score, coins_earned, balance, replayed}`. Called only by the `submit-solve` Edge Function (Task 9).
  - `credit_purchase(p_user_id uuid, p_product_id text, p_event_id text, p_is_refund boolean) RETURNS jsonb` → `{coins, balance, replayed}`. Called only by the webhook (Task 10).

- [ ] **Step 1: Write the failing test**

Create `__tests__/integration/submitSolve.test.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestUser, deleteTestUser, describeIntegration, serviceClient,
} from "./setup";

describeIntegration("submit_solve and credit_purchase", () => {
  let db: SupabaseClient;
  let userId: string;
  let puzzleId: string;

  beforeAll(async () => {
    db = serviceClient();
    const { data } = await db.from("daily_puzzles")
      .select("id").eq("difficulty", "medium").limit(1).single();
    puzzleId = data!.id;
  });

  beforeEach(async () => {
    userId = await createTestUser(db);
    await db.from("users").upsert({ id: userId, coins: 0, total_score: 0,
      puzzles_solved: 0, current_streak: 0 });
  });

  afterEach(async () => { await deleteTestUser(db, userId); });

  const submit = (score = 200) => db.rpc("submit_solve", {
    p_user_id: userId, p_puzzle_id: puzzleId, p_accuracy: 1.0,
    p_time_seconds: 300, p_reported_time: 300, p_hints_used: 0,
    p_score: score, p_suspect: false,
  });

  it("records the completion, credits the reward, and updates totals", async () => {
    const { data, error } = await submit(200);
    expect(error).toBeNull();
    expect(data.coins_earned).toBe(25); // medium
    expect(data.balance).toBe(25);

    const { data: u } = await db.from("users")
      .select("total_score, puzzles_solved, current_streak")
      .eq("id", userId).single();
    expect(u!.total_score).toBe(200);
    expect(u!.puzzles_solved).toBe(1);
    expect(u!.current_streak).toBe(1);
  });

  it("replays to the original result without paying twice", async () => {
    await submit(200);
    const { data } = await submit(999);
    expect(data.replayed).toBe(true);
    expect(data.score).toBe(200);
    expect(data.balance).toBe(25);
  });

  it("increments puzzle_stats", async () => {
    await submit(200);
    const { data } = await db.from("puzzle_stats")
      .select("players_completed, avg_score").eq("puzzle_id", puzzleId).single();
    expect(data!.players_completed).toBeGreaterThanOrEqual(1);
  });

  it("credits a purchase once per event id", async () => {
    await db.from("coin_products").upsert({
      product_id: "test.coins.500", coins: 500, display_name: "Test 500",
    });
    const a = await db.rpc("credit_purchase", {
      p_user_id: userId, p_product_id: "test.coins.500",
      p_event_id: "evt_1", p_is_refund: false,
    });
    const b = await db.rpc("credit_purchase", {
      p_user_id: userId, p_product_id: "test.coins.500",
      p_event_id: "evt_1", p_is_refund: false,
    });
    expect(a.data.balance).toBe(500);
    expect(b.data.balance).toBe(500);
    expect(b.data.replayed).toBe(true);
  });

  it("rejects an unknown SKU rather than guessing", async () => {
    const { error } = await db.rpc("credit_purchase", {
      p_user_id: userId, p_product_id: "cruxe_pack_v2",
      p_event_id: "evt_2", p_is_refund: false,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("unknown_product");
  });

  it("lets a refund drive the balance negative", async () => {
    await db.from("coin_products").upsert({
      product_id: "test.coins.500", coins: 500, display_name: "Test 500",
    });
    await db.rpc("credit_purchase", { p_user_id: userId,
      p_product_id: "test.coins.500", p_event_id: "evt_3", p_is_refund: false });
    await db.rpc("ledger_apply", { p_user_id: userId, p_delta: -500,
      p_reason: "entry_fee", p_idempotency_key: `spend:${userId}`,
      p_metadata: {}, p_allow_negative: false });
    const { data } = await db.rpc("credit_purchase", { p_user_id: userId,
      p_product_id: "test.coins.500", p_event_id: "evt_3r", p_is_refund: true });
    expect(data.balance).toBe(-500);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/integration/submitSolve.test.ts`
Expected: FAIL — `Could not find the function public.submit_solve`.

- [ ] **Step 3: Append the functions to `007_economy_rpcs.sql`**

```sql
-- ---------- submit_solve (service role only) ----------
CREATE OR REPLACE FUNCTION public.submit_solve(
  p_user_id       UUID,
  p_puzzle_id     UUID,
  p_accuracy      REAL,
  p_time_seconds  INT,
  p_reported_time INT,
  p_hints_used    INT,
  p_score         INT,
  p_suspect       BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_key        TEXT := 'solve:' || p_user_id::TEXT || ':' || p_puzzle_id::TEXT;
  v_existing   RECORD;
  v_puzzle     RECORD;
  v_reward     INT;
  v_balance    INT;
  v_today      DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_last       DATE;
  v_streak     INT;
BEGIN
  -- Replay: return the stored result untouched.
  SELECT score, coins_earned INTO v_existing
    FROM puzzle_completions
   WHERE user_id = p_user_id AND puzzle_id = p_puzzle_id;
  IF FOUND THEN
    SELECT coins INTO v_balance FROM users WHERE id = p_user_id;
    RETURN jsonb_build_object('score', v_existing.score,
                              'coins_earned', v_existing.coins_earned,
                              'balance', v_balance, 'replayed', TRUE);
  END IF;

  SELECT category, difficulty, grid_size, puzzle_date
    INTO v_puzzle FROM daily_puzzles WHERE id = p_puzzle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'puzzle_not_found'; END IF;

  SELECT (value->>v_puzzle.difficulty)::INT INTO v_reward
    FROM economy_config WHERE key = 'solve_rewards';

  INSERT INTO puzzle_completions (
    user_id, puzzle_id, score, time_taken, accuracy, hints_used,
    coins_earned, puzzle_date, category, difficulty, grid_size,
    suspect, reported_time_seconds
  ) VALUES (
    p_user_id, p_puzzle_id, p_score, p_time_seconds, p_accuracy, p_hints_used,
    v_reward, v_puzzle.puzzle_date, v_puzzle.category, v_puzzle.difficulty,
    v_puzzle.grid_size, p_suspect, p_reported_time
  );

  v_balance := ledger_apply(
    p_user_id, v_reward, 'solve_reward', v_key,
    jsonb_build_object('puzzle_id', p_puzzle_id, 'score', p_score)
  );

  -- Streak: continues if the last play was yesterday, resets otherwise,
  -- and is left alone if the player already played today.
  SELECT last_played_date, current_streak INTO v_last, v_streak
    FROM users WHERE id = p_user_id FOR UPDATE;

  IF v_last IS DISTINCT FROM v_today THEN
    v_streak := CASE WHEN v_last = v_today - 1
                     THEN COALESCE(v_streak, 0) + 1 ELSE 1 END;
  END IF;

  UPDATE users SET
    total_score      = COALESCE(total_score, 0) + p_score,
    puzzles_solved   = COALESCE(puzzles_solved, 0) + 1,
    current_streak   = v_streak,
    longest_streak   = GREATEST(COALESCE(longest_streak, 0), v_streak),
    last_played_date = v_today
  WHERE id = p_user_id;

  RETURN jsonb_build_object('score', p_score, 'coins_earned', v_reward,
                            'balance', v_balance, 'replayed', FALSE);
END;
$$;

-- ---------- credit_purchase (service role only) ----------
CREATE OR REPLACE FUNCTION public.credit_purchase(
  p_user_id    UUID,
  p_product_id TEXT,
  p_event_id   TEXT,
  p_is_refund  BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coins    INT;
  v_key      TEXT;
  v_balance  INT;
  v_existing INT;
BEGIN
  SELECT coins INTO v_coins
    FROM coin_products WHERE product_id = p_product_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_product: %', p_product_id;
  END IF;

  v_key := CASE WHEN p_is_refund THEN 'rc_refund:' ELSE 'rc:' END || p_event_id;

  SELECT balance_after INTO v_existing
    FROM coin_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('coins', v_coins, 'balance', v_existing,
                              'replayed', TRUE);
  END IF;

  v_balance := ledger_apply(
    p_user_id,
    CASE WHEN p_is_refund THEN -v_coins ELSE v_coins END,
    CASE WHEN p_is_refund THEN 'refund'::coin_reason
                          ELSE 'iap_purchase'::coin_reason END,
    v_key,
    jsonb_build_object('product_id', p_product_id, 'event_id', p_event_id),
    p_is_refund   -- refunds may drive the balance negative
  );

  RETURN jsonb_build_object('coins', v_coins, 'balance', v_balance,
                            'replayed', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_solve(UUID, UUID, REAL, INT, INT, INT, INT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_purchase(UUID, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 4: Apply and rerun**

Run the SQL, then `npx jest __tests__/integration/submitSolve.test.ts`.
Expected: PASS, except `increments puzzle_stats`, which needs Task 6's trigger.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_economy_rpcs.sql __tests__/integration/submitSolve.test.ts
git commit -m "feat(db): service-role submit_solve and credit_purchase"
```

---

### Task 6: Lockdown, auth trigger, leaderboard, and puzzle stats

This is the task that actually closes the vulnerabilities. After it, the `cannot write users.coins` and `increments puzzle_stats` assertions from Tasks 4 and 5 must pass.

**Files:**
- Create: `supabase/migrations/008_lockdown_and_leaderboard.sql`
- Create: `__tests__/integration/rls.test.ts`

**Interfaces:**
- Produces: `get_leaderboard(p_limit int) RETURNS TABLE(...)`; a trigger-created profile row plus welcome bonus on signup; `puzzle_stats` maintenance.

- [ ] **Step 1: Write the failing test**

Create `__tests__/integration/rls.test.ts`:

```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { describeIntegration, serviceClient } from "./setup";

describeIntegration("RLS lockdown", () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let otherId: string;

  beforeAll(async () => { admin = serviceClient(); });

  beforeEach(async () => {
    const addr = `t-${Date.now()}-${Math.random().toString(36).slice(2)}@cruxe.test`;
    const { data } = await admin.auth.admin.createUser({
      email: addr, password: "test-password-123", email_confirm: true,
    });
    userId = data.user!.id;

    const { data: o } = await admin.auth.admin.createUser({
      email: `o-${addr}`, password: "test-password-123", email_confirm: true,
    });
    otherId = o.user!.id;

    user = createClient(process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_ANON_KEY!, { auth: { persistSession: false } });
    await user.auth.signInWithPassword({ email: addr, password: "test-password-123" });
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
    await admin.auth.admin.deleteUser(otherId);
  });

  it("creates the profile and welcome bonus on signup", async () => {
    const { data } = await admin.from("users").select("coins").eq("id", userId).single();
    expect(data!.coins).toBe(200);

    const { data: led } = await admin.from("coin_ledger")
      .select("reason, delta").eq("user_id", userId);
    expect(led).toEqual([{ reason: "welcome_bonus", delta: 200 }]);
  });

  it("blocks writing your own coins", async () => {
    const { error } = await user.from("users").update({ coins: 999999 }).eq("id", userId);
    expect(error).not.toBeNull();
  });

  it("blocks reading another user's row", async () => {
    const { data } = await user.from("users").select("coins").eq("id", otherId);
    expect(data).toEqual([]);
  });

  it("blocks inserting a completion directly", async () => {
    const { data: p } = await admin.from("daily_puzzles").select("id").limit(1).single();
    const { error } = await user.from("puzzle_completions").insert({
      user_id: userId, puzzle_id: p!.id, score: 999999, time_taken: 1,
      accuracy: 1, puzzle_date: "2026-08-15", category: "general",
      difficulty: "expert", grid_size: 12,
    });
    expect(error).not.toBeNull();
  });

  it("exposes only safe leaderboard columns", async () => {
    const { data, error } = await user.rpc("get_leaderboard", { p_limit: 10 });
    expect(error).toBeNull();
    if (data && data.length > 0) {
      expect(Object.keys(data[0]).sort()).toEqual(
        ["display_name", "puzzles_solved", "rank", "streak", "total_score", "user_id"],
      );
    }
  });

  it("lets a user read their own ledger but not another's", async () => {
    const mine = await user.from("coin_ledger").select("*").eq("user_id", userId);
    expect(mine.error).toBeNull();
    const theirs = await user.from("coin_ledger").select("*").eq("user_id", otherId);
    expect(theirs.data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/integration/rls.test.ts`
Expected: FAIL — welcome bonus absent, coin write succeeds, other user's row readable.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/008_lockdown_and_leaderboard.sql`:

```sql
-- ============================================================
-- Cruxe Migration 008: lock the client out of its own economy
-- ============================================================

-- ---------- users: read-only to clients ----------
DROP POLICY IF EXISTS "Anyone can read leaderboard data" ON users;  -- the hole
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

REVOKE INSERT, UPDATE, DELETE ON users FROM authenticated, anon;

-- "Users can read their own profile" (auth.uid() = id) from 003 is retained.

-- ---------- profile creation moves to a trigger ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_welcome INT;
BEGIN
  INSERT INTO public.users (id, display_name, coins)
  VALUES (NEW.id, 'Player', 0)
  ON CONFLICT (id) DO NOTHING;

  SELECT (value->>'coins')::INT INTO v_welcome
    FROM economy_config WHERE key = 'welcome_bonus';

  PERFORM ledger_apply(NEW.id, v_welcome, 'welcome_bonus',
                       'welcome:' || NEW.id::TEXT);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- puzzle_completions: service-role write, own-row read ----------
DROP POLICY IF EXISTS "Anyone can read completions"        ON puzzle_completions;
DROP POLICY IF EXISTS "Users can insert own completions"   ON puzzle_completions;
DROP POLICY IF EXISTS "Users can update own completions"   ON puzzle_completions;

REVOKE INSERT, UPDATE, DELETE ON puzzle_completions FROM authenticated, anon;

CREATE POLICY "Users read own completions"
  ON puzzle_completions FOR SELECT
  USING (auth.uid()::TEXT = user_id::TEXT);

-- ---------- coin_ledger / hint_events: own-row read only ----------
ALTER TABLE coin_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hint_events  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ledger"
  ON coin_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own hint events"
  ON hint_events FOR SELECT USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON coin_ledger, hint_events FROM authenticated, anon;

-- ---------- public config and aggregates ----------
ALTER TABLE economy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_stats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_events     ENABLE ROW LEVEL SECURITY;  -- no policy = service role only

CREATE POLICY "Anyone reads economy config"
  ON economy_config FOR SELECT USING (TRUE);
CREATE POLICY "Anyone reads coin products"
  ON coin_products FOR SELECT USING (TRUE);
CREATE POLICY "Anyone reads puzzle stats"
  ON puzzle_stats FOR SELECT USING (TRUE);

REVOKE INSERT, UPDATE, DELETE
  ON economy_config, coin_products, puzzle_stats, iap_events
  FROM authenticated, anon;

-- ---------- puzzle_stats maintenance ----------
CREATE OR REPLACE FUNCTION public.bump_puzzle_stats()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO puzzle_stats (puzzle_id, players_completed, avg_score, updated_at)
  VALUES (NEW.puzzle_id, 1, NEW.score, NOW())
  ON CONFLICT (puzzle_id) DO UPDATE SET
    avg_score = (
      (puzzle_stats.avg_score * puzzle_stats.players_completed) + NEW.score
    ) / (puzzle_stats.players_completed + 1),
    players_completed = puzzle_stats.players_completed + 1,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_puzzle_stats ON puzzle_completions;
CREATE TRIGGER trg_bump_puzzle_stats
  AFTER INSERT ON puzzle_completions
  FOR EACH ROW EXECUTE FUNCTION public.bump_puzzle_stats();

-- ---------- leaderboard ----------
DROP VIEW IF EXISTS leaderboard_view;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit INT DEFAULT 50)
RETURNS TABLE (
  user_id        UUID,
  display_name   TEXT,
  total_score    INT,
  puzzles_solved INT,
  streak         INT,
  rank           BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.display_name, u.total_score, u.puzzles_solved,
         u.current_streak,
         ROW_NUMBER() OVER (ORDER BY u.total_score DESC, u.id)
    FROM users u
   WHERE u.puzzles_solved >= COALESCE(
           (SELECT (value->>'min_puzzles_solved')::INT
              FROM economy_config WHERE key = 'leaderboard'), 3)
   ORDER BY u.total_score DESC, u.id
   LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT) TO authenticated, anon;
```

- [ ] **Step 4: Apply and run the full integration suite**

Run the SQL, then `npx jest __tests__/integration`.
Expected: PASS across all four integration files, including the two assertions deferred from Tasks 4 and 5. If you marked `cannot write users.coins` as `it.failing`, change it back to `it` now and confirm it passes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/008_lockdown_and_leaderboard.sql __tests__/integration/rls.test.ts
git commit -m "feat(db): revoke client economy writes, add auth trigger and safe leaderboard"
```

---

### Task 7: Migrate `puzzle_completions.user_id` to UUID

**Files:**
- Create: `supabase/migrations/009_completions_uuid.sql`

**Interfaces:**
- Consumes: Task 6's policies (recreated here against the new column type).
- Produces: `puzzle_completions.user_id UUID` with an FK to `auth.users`.

- [ ] **Step 1: Write the migration**

The spec authorises a clean-slate truncate; there are no real users.

```sql
-- ============================================================
-- Cruxe Migration 009: puzzle_completions.user_id TEXT -> UUID
-- Clean slate: no production users exist (see spec D8).
-- ============================================================

TRUNCATE TABLE puzzle_completions CASCADE;
TRUNCATE TABLE puzzle_stats CASCADE;

DROP POLICY IF EXISTS "Users read own completions" ON puzzle_completions;

ALTER TABLE puzzle_completions
  ALTER COLUMN user_id TYPE UUID USING user_id::UUID,
  ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE puzzle_completions
  ADD CONSTRAINT fk_completions_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "Users read own completions"
  ON puzzle_completions FOR SELECT
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Apply and verify the column type**

Run the SQL, then:

```sql
SELECT data_type FROM information_schema.columns
 WHERE table_name = 'puzzle_completions' AND column_name = 'user_id';
```

Expected: `uuid`.

- [ ] **Step 3: Rerun the integration suite**

Run: `npx jest __tests__/integration`
Expected: PASS. `submit_solve` writes a UUID, so no cast is needed anywhere.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_completions_uuid.sql
git commit -m "refactor(db): puzzle_completions.user_id to UUID with FK"
```

---

### Task 8: Store built grids at generation time

Verification is impossible while the client builds a random grid. This moves construction into the generator.

**Files:**
- Create: `supabase/functions/_shared/grid.ts`
- Create: `__tests__/grid.test.ts`
- Modify: `scripts/generate-daily-puzzles-free.ts`
- Modify: `services/puzzleService.ts:546-579` (`fetchPuzzleById`)

**Interfaces:**
- Consumes: `services/crosswordEngine.ts`'s existing `buildPuzzle`.
- Produces: `canonicalCellOrder(grid): {row, col}[]`, `lettersFromGrid(grid): string`, `verifySubmission(grid, letters): {accuracy, isComplete, correctCells, totalCells}`. Task 9 imports all three.

- [ ] **Step 1: Write the failing test**

Create `__tests__/grid.test.ts`:

```ts
import {
  canonicalCellOrder, lettersFromGrid, verifySubmission,
} from "../supabase/functions/_shared/grid";
import type { StoredCell } from "../supabase/functions/_shared/grid";

/** 2x2: (0,0)=C (0,1)=A (1,0)=blocked (1,1)=T */
const grid: StoredCell[][] = [
  [{ letter: "C", isBlocked: false }, { letter: "A", isBlocked: false }],
  [{ letter: null, isBlocked: true }, { letter: "T", isBlocked: false }],
];

describe("grid verification", () => {
  it("orders fillable cells row-major, skipping blocked ones", () => {
    expect(canonicalCellOrder(grid)).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 },
    ]);
  });

  it("serialises the answer key in canonical order", () => {
    expect(lettersFromGrid(grid)).toBe("CAT");
  });

  it("accepts a perfect submission", () => {
    const r = verifySubmission(grid, "CAT");
    expect(r.isComplete).toBe(true);
    expect(r.accuracy).toBe(1);
  });

  it("scores a partial submission by correct cells", () => {
    const r = verifySubmission(grid, "CXT");
    expect(r.isComplete).toBe(false);
    expect(r.correctCells).toBe(2);
    expect(r.accuracy).toBeCloseTo(2 / 3);
  });

  it("is case-insensitive and treats blanks as wrong", () => {
    const r = verifySubmission(grid, "ca ");
    expect(r.correctCells).toBe(2);
  });

  it("rejects a submission of the wrong length", () => {
    expect(() => verifySubmission(grid, "CATS")).toThrow("length_mismatch");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest __tests__/grid.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `supabase/functions/_shared/grid.ts`**

```ts
/**
 * grid.ts — Canonical grid serialisation and verification.
 *
 * Shared by the submit-solve Edge Function and the client. The canonical
 * order is row-major over non-blocked cells; both sides must agree exactly
 * or every submission will mis-verify.
 */

export interface StoredCell {
  letter: string | null;
  isBlocked: boolean;
}

export interface VerificationResult {
  accuracy: number;
  isComplete: boolean;
  correctCells: number;
  totalCells: number;
}

export function canonicalCellOrder<T extends StoredCell>(
  grid: T[][],
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (!grid[row][col].isBlocked) out.push({ row, col });
    }
  }
  return out;
}

export function lettersFromGrid<T extends StoredCell>(grid: T[][]): string {
  return canonicalCellOrder(grid)
    .map(({ row, col }) => (grid[row][col].letter ?? " ").toUpperCase())
    .join("");
}

export function verifySubmission<T extends StoredCell>(
  grid: T[][],
  submitted: string,
): VerificationResult {
  const answer = lettersFromGrid(grid);
  if (submitted.length !== answer.length) {
    throw new Error("length_mismatch");
  }
  const guess = submitted.toUpperCase();

  let correctCells = 0;
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) correctCells++;
  }

  const totalCells = answer.length;
  return {
    correctCells,
    totalCells,
    accuracy: totalCells === 0 ? 0 : correctCells / totalCells,
    isComplete: correctCells === totalCells,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest __tests__/grid.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Build the grid in the generator**

In `scripts/generate-daily-puzzles-free.ts`, find where `puzzle_data` is assembled as `{ words, metadata }` before the Supabase insert. Import the engine and store the built grid alongside the words:

```ts
import { buildPuzzle } from "../services/crosswordEngine";
```

Replace the `puzzle_data` payload construction with:

```ts
// Build the grid once, here, so every player gets the identical layout and
// the server can verify submissions against a known answer key.
const built = buildPuzzle(words, spec.category as any, spec.difficulty as any,
                          spec.gridSize as any, undefined);
if (!built) {
  console.error(`  ✗ Grid construction failed for ${label}; skipping.`);
  continue;
}

const puzzleData = {
  words,
  grid: built.grid.map((row) =>
    row.map((c) => ({
      letter: c.letter,
      isBlocked: c.isBlocked,
      isPreFilled: c.isPreFilled,
      clueNumbers: c.clueNumbers,
      clueIds: c.clueIds,
    })),
  ),
  clues: built.clues,
  metadata: {
    category: spec.category,
    difficulty: spec.difficulty,
    gridSize: spec.gridSize,
    isDailyChallenge: spec.isDailyChallenge,
    estimatedTime: built.estimatedTime,
    totalWords: built.totalWords,
  },
};
```

Then use `puzzleData` in the insert, and set `total_words: built.totalWords` and `estimated_time: built.estimatedTime`.

- [ ] **Step 6: Make the client prefer the stored grid**

In `services/puzzleService.ts`, replace the body of `fetchPuzzleById` after the null checks:

```ts
  const puzzleData = data.puzzle_data;
  if (!puzzleData) return null;

  // Preferred path: the generator stored a built grid, so every player sees
  // the identical layout and the server can verify the solve.
  if (puzzleData.grid && puzzleData.clues) {
    const puzzle = hydrateStoredPuzzle(puzzleData, data);
    puzzleCache.set(cacheKey, puzzle);
    return puzzle;
  }

  // Legacy path: rows generated before grids were stored. These produce a
  // per-device random layout and cannot be server-verified. They age out of
  // the 7-day query window; remove this branch afterwards.
  if (!puzzleData.words) return null;
  console.warn(`[puzzleService] Puzzle ${puzzleId} has no stored grid (legacy row).`);
  const puzzle = buildPuzzle(
    puzzleData.words,
    data.category || "general",
    data.difficulty || "medium",
    data.grid_size || 10,
    data.id,
  );
  if (puzzle) puzzleCache.set(cacheKey, puzzle);
  return puzzle;
```

Add above `fetchPuzzleById`:

```ts
/** Rehydrates a stored grid into the runtime Puzzle shape the UI expects. */
function hydrateStoredPuzzle(pd: any, row: any): Puzzle {
  const grid: GridCellType[][] = pd.grid.map((r: any[], row_i: number) =>
    r.map((c: any, col_i: number) => ({
      row: row_i,
      col: col_i,
      letter: c.letter,
      isBlocked: c.isBlocked,
      isPreFilled: c.isPreFilled,
      userInput: c.isPreFilled ? (c.letter ?? "") : "",
      clueNumbers: c.clueNumbers ?? [],
      clueIds: c.clueIds ?? [],
      state: c.isPreFilled ? "prefilled" : "empty",
    })),
  );

  const clues = pd.clues as CrosswordClue[];
  return {
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    gridSize: row.grid_size,
    grid,
    clues,
    acrossClues: clues.filter((c) => c.direction === "across"),
    downClues: clues.filter((c) => c.direction === "down"),
    reverseAcrossClues: clues.filter((c) => c.direction === "reverse_across"),
    reverseDownClues: clues.filter((c) => c.direction === "reverse_down"),
    date: pd.metadata?.date ?? new Date().toISOString().split("T")[0],
    estimatedTime: pd.metadata?.estimatedTime ?? 0,
    totalWords: pd.metadata?.totalWords ?? clues.length,
    solvedWords: 0,
    isComplete: false,
    startedAt: Date.now(),
    completedAt: null,
    score: 0,
    hintsUsed: 0,
  };
}
```

Add `CrosswordClue` and `GridCell as GridCellType` to the existing type import at the top of the file.

- [ ] **Step 7: Regenerate puzzles and verify a grid is stored**

```bash
npx tsx scripts/generate-daily-puzzles-free.ts 2026-08-15
```

Then in the SQL editor:

```sql
SELECT id, jsonb_array_length(puzzle_data->'grid') AS rows
  FROM daily_puzzles WHERE puzzle_date = '2026-08-15' LIMIT 5;
```

Expected: `rows` equals each puzzle's grid size.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/grid.ts __tests__/grid.test.ts scripts/generate-daily-puzzles-free.ts services/puzzleService.ts
git commit -m "feat: build grids at generation time; add canonical verification"
```

---

### Task 9: `submit-solve` Edge Function

**Files:**
- Create: `supabase/functions/submit-solve/index.ts`
- Create: `supabase/functions/_shared/config.ts`

**Interfaces:**
- Consumes: `verifySubmission` (Task 8), `calculateScore` (Task 1), `submit_solve` RPC (Task 5).
- Produces: `POST /functions/v1/submit-solve` accepting `{ puzzleId, letters, clientElapsedSeconds }` and returning `{ score, grade, breakdown, coinsEarned, newBalance, accuracy, verified }`. Task 13 calls it.

- [ ] **Step 1: Create the config loader**

Create `supabase/functions/_shared/config.ts`:

```ts
import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ScoringConfig, TimeBounds } from "./economyTypes.ts";

/** Reads a single economy_config row. Throws rather than falling back —
 *  a server that cannot read its own prices must not award anything. */
export async function loadConfig<T>(
  db: SupabaseClient,
  key: string,
): Promise<T> {
  const { data, error } = await db
    .from("economy_config").select("value").eq("key", key).single();
  if (error || !data) throw new Error(`missing_config:${key}`);
  return data.value as T;
}

export const loadScoring = (db: SupabaseClient) =>
  loadConfig<ScoringConfig>(db, "scoring");
export const loadTimeBounds = (db: SupabaseClient) =>
  loadConfig<TimeBounds>(db, "time_bounds");
```

> Deno resolves `./economyTypes.ts` with the extension; Metro resolves the extensionless import used by the client. Both point at the same file.

- [ ] **Step 2: Write the Edge Function**

Create `supabase/functions/submit-solve/index.ts`:

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifySubmission } from "../_shared/grid.ts";
import { calculateScore } from "../_shared/scoring.ts";
import { loadScoring, loadTimeBounds } from "../_shared/config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1. Identity comes from the verified JWT. The body never carries a user id.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  let body: { puzzleId?: string; letters?: string; clientElapsedSeconds?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const { puzzleId, letters, clientElapsedSeconds } = body;
  if (!puzzleId || typeof letters !== "string" ||
      typeof clientElapsedSeconds !== "number") {
    return json({ error: "bad_request" }, 400);
  }

  // 2. Load the stored grid — the answer key the server owns.
  const { data: puzzle, error: pErr } = await admin
    .from("daily_puzzles")
    .select("id, difficulty, grid_size, puzzle_data")
    .eq("id", puzzleId)
    .single();
  if (pErr || !puzzle) return json({ error: "puzzle_not_found" }, 404);

  const storedGrid = puzzle.puzzle_data?.grid;
  if (!storedGrid) return json({ error: "puzzle_not_verifiable" }, 409);

  // 3. Verify the submission against the answer key.
  let result;
  try {
    result = verifySubmission(storedGrid, letters);
  } catch {
    return json({ error: "length_mismatch" }, 400);
  }
  if (!result.isComplete) return json({ error: "incomplete_solve" }, 422);

  // 4. Hints are counted from the server's own records, never the client's.
  //    The penalty is per *letter* revealed, so a reveal-word that uncovered
  //    eight letters must count as eight — hence summing letters_revealed
  //    rather than counting rows.
  const { data: hintRows } = await admin
    .from("hint_events")
    .select("letters_revealed")
    .eq("user_id", userId)
    .eq("puzzle_id", puzzleId);
  const hintsUsed = (hintRows ?? [])
    .reduce((sum, r) => sum + (r.letters_revealed ?? 0), 0);

  // 5. Clamp the one client-supplied quantity.
  const bounds = await loadTimeBounds(admin);
  const floor = Math.ceil(
    result.totalCells * bounds.floorPerCellSeconds +
      (puzzle.puzzle_data?.metadata?.totalWords ?? 0) * bounds.floorPerWordSeconds,
  );
  const reported = Math.max(0, Math.floor(clientElapsedSeconds));
  const suspect = reported < floor;
  const timeTaken = Math.min(Math.max(reported, floor), bounds.ceilingSeconds);

  // 6. Recompute the score. The client's claim is not in the payload at all.
  const scoring = await loadScoring(admin);
  const breakdown = calculateScore(
    {
      difficulty: puzzle.difficulty,
      gridSize: puzzle.grid_size,
      accuracy: result.accuracy,
      timeTaken,
      hintsUsed,
    },
    scoring,
  );

  // 7. Award, idempotently.
  const { data: awarded, error: awardErr } = await admin.rpc("submit_solve", {
    p_user_id: userId,
    p_puzzle_id: puzzleId,
    p_accuracy: result.accuracy,
    p_time_seconds: timeTaken,
    p_reported_time: reported,
    p_hints_used: hintsUsed,
    p_score: breakdown.finalScore,
    p_suspect: suspect,
  });
  if (awardErr) {
    console.error("[submit-solve] award failed", awardErr);
    return json({ error: "award_failed" }, 500);
  }

  return json({
    score: awarded.score,
    grade: breakdown.grade,
    breakdown,
    coinsEarned: awarded.coins_earned,
    newBalance: awarded.balance,
    accuracy: result.accuracy,
    hintsUsed,
    replayed: awarded.replayed,
    verified: true,
  });
});
```

- [ ] **Step 3: Deploy and smoke-test**

```bash
npx supabase functions deploy submit-solve
```

Test with a real user JWT and a real puzzle id:

```bash
curl -X POST "$SUPABASE_TEST_URL/functions/v1/submit-solve" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"puzzleId":"<id>","letters":"<answer key>","clientElapsedSeconds":400}'
```

Expected: HTTP 200 with a `score`, `coinsEarned` matching the difficulty reward, and `verified: true`. Submitting a wrong letter string returns 422 `incomplete_solve`. Submitting `clientElapsedSeconds: 1` returns 200 but writes `suspect = true` — confirm with:

```sql
SELECT suspect, time_taken, reported_time_seconds FROM puzzle_completions
 ORDER BY completed_at DESC LIMIT 1;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/submit-solve/ supabase/functions/_shared/config.ts
git commit -m "feat(edge): server-verified solve submission"
```

---

### Task 10: RevenueCat webhook and purchase reconciliation

**Files:**
- Create: `supabase/functions/revenuecat-webhook/index.ts`
- Create: `supabase/functions/sync-purchases/index.ts`
- Create: `supabase/config.toml` entry for the webhook (or dashboard setting)

**Interfaces:**
- Consumes: `credit_purchase` (Task 5), `coin_products` (Task 2).
- Produces: `POST /functions/v1/revenuecat-webhook` (shared-secret auth) and `POST /functions/v1/sync-purchases` (JWT). Task 15 calls `sync-purchases`.

- [ ] **Step 1: Seed the product catalogue**

Replace the placeholder SKUs with your real App Store / Play Console product ids:

```sql
INSERT INTO coin_products (product_id, coins, display_name, bonus_percent) VALUES
  ('com.cruxe.coins.starter', 500,   'Starter Pack',  0),
  ('com.cruxe.coins.plus',    1200,  'Plus Pack',     20),
  ('com.cruxe.coins.pro',     3000,  'Pro Pack',      50),
  ('com.cruxe.coins.elite',   8000,  'Elite Pack',    100)
ON CONFLICT (product_id) DO UPDATE
  SET coins = EXCLUDED.coins, display_name = EXCLUDED.display_name,
      bonus_percent = EXCLUDED.bonus_percent;
```

Commit this as `supabase/migrations/010_seed_coin_products.sql`.

- [ ] **Step 2: Write the webhook**

Create `supabase/functions/revenuecat-webhook/index.ts`:

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;

/** Length-safe constant-time comparison. */
function secureEquals(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });

/** Events that grant coins, and those that take them back. */
const GRANT_TYPES = new Set(["NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"]);
const REFUND_TYPES = new Set(["CANCELLATION", "REFUND"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const provided = req.headers.get("Authorization") ?? "";
  if (!secureEquals(provided, WEBHOOK_SECRET)) {
    console.warn("[revenuecat-webhook] rejected: bad secret");
    return json({ error: "unauthorized" }, 401);
  }

  const payload = await req.json();
  const event = payload?.event;
  if (!event?.id) return json({ error: "bad_event" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const userId: string | null = event.app_user_id ?? null;
  const productId: string | null = event.product_id ?? null;
  const type: string = event.type ?? "UNKNOWN";

  // Always record the raw event first, so a later failure is still auditable.
  await db.from("iap_events").upsert({
    event_id: String(event.id),
    user_id: userId,
    product_id: productId,
    event_type: type,
    is_sandbox: Boolean(event.environment === "SANDBOX"),
    payload,
  }, { onConflict: "event_id" });

  const isRefund = REFUND_TYPES.has(type);
  if (!GRANT_TYPES.has(type) && !isRefund) {
    return json({ ok: true, ignored: type });
  }

  if (!userId || !productId) {
    console.error("[revenuecat-webhook] missing app_user_id or product_id", event.id);
    return json({ error: "incomplete_event" }, 400);
  }

  const { data, error } = await db.rpc("credit_purchase", {
    p_user_id: userId,
    p_product_id: productId,
    p_event_id: String(event.id),
    p_is_refund: isRefund,
  });

  if (error) {
    // An unknown SKU is a configuration bug, not a transient failure.
    // Return 200 so RevenueCat stops retrying, but log loudly.
    if (error.message?.includes("unknown_product")) {
      console.error("[revenuecat-webhook] UNKNOWN SKU — add it to coin_products:",
                    productId);
      return json({ error: "unknown_product", productId }, 200);
    }
    console.error("[revenuecat-webhook] credit failed", error);
    return json({ error: "credit_failed" }, 500); // 5xx => RevenueCat retries
  }

  return json({ ok: true, ...data });
});
```

- [ ] **Step 3: Disable JWT verification for the webhook**

RevenueCat is not a logged-in user, so the function must accept unauthenticated requests; the shared secret is its authentication. Create `supabase/config.toml` if absent and add:

```toml
[functions.revenuecat-webhook]
verify_jwt = false
```

- [ ] **Step 4: Write `sync-purchases`**

Create `supabase/functions/sync-purchases/index.ts`:

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  // Ask RevenueCat what this customer actually bought.
  const rcRes = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${RC_SECRET_KEY}` } },
  );
  if (!rcRes.ok) {
    console.error("[sync-purchases] RevenueCat lookup failed", rcRes.status);
    return json({ error: "revenuecat_unavailable" }, 502);
  }

  const body = await rcRes.json();
  const nonSubs: Record<string, any[]> =
    body?.subscriber?.non_subscriptions ?? {};

  let credited = 0;
  for (const [productId, purchases] of Object.entries(nonSubs)) {
    for (const purchase of purchases) {
      const eventId = `sync_${purchase.id ?? purchase.store_transaction_id}`;

      const { data: seen } = await db
        .from("iap_events").select("event_id").eq("event_id", eventId).maybeSingle();
      if (seen) continue;

      await db.from("iap_events").upsert({
        event_id: eventId, user_id: userId, product_id: productId,
        event_type: "SYNC_RECONCILE",
        is_sandbox: Boolean(purchase.is_sandbox), payload: purchase,
      }, { onConflict: "event_id" });

      const { error } = await db.rpc("credit_purchase", {
        p_user_id: userId, p_product_id: productId,
        p_event_id: eventId, p_is_refund: false,
      });
      if (!error) credited++;
      else console.error("[sync-purchases] credit failed", productId, error.message);
    }
  }

  const { data: profile } = await db
    .from("users").select("coins").eq("id", userId).single();

  return json({ credited, balance: profile?.coins ?? 0 });
});
```

- [ ] **Step 5: Set secrets and deploy**

```bash
npx supabase secrets set REVENUECAT_WEBHOOK_SECRET="<a long random string>"
npx supabase secrets set REVENUECAT_SECRET_API_KEY="<RevenueCat secret API key>"
npx supabase functions deploy revenuecat-webhook
npx supabase functions deploy sync-purchases
```

In the RevenueCat dashboard → Integrations → Webhooks, set the URL to
`https://<project>.supabase.co/functions/v1/revenuecat-webhook` and the
Authorization header to the same random string.

- [ ] **Step 6: Verify idempotency with a replayed event**

Send the same synthetic event twice:

```bash
curl -X POST "$SUPABASE_TEST_URL/functions/v1/revenuecat-webhook" \
  -H "Authorization: $REVENUECAT_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":{"id":"evt_test_1","type":"NON_RENEWING_PURCHASE",
       "app_user_id":"<uuid>","product_id":"com.cruxe.coins.starter",
       "environment":"SANDBOX"}}'
```

Expected: first call `replayed: false`, second `replayed: true`, and exactly one `coin_ledger` row:

```sql
SELECT COUNT(*) FROM coin_ledger WHERE idempotency_key = 'rc:evt_test_1';
```

Expected: `1`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/revenuecat-webhook/ supabase/functions/sync-purchases/ supabase/config.toml supabase/migrations/010_seed_coin_products.sql
git commit -m "feat(edge): durable idempotent IAP grants and purchase reconciliation"
```

---

### Task 11: Account deletion

**Files:**
- Create: `supabase/functions/delete-account/index.ts`

**Interfaces:**
- Produces: `POST /functions/v1/delete-account` (JWT). Task 16 calls it.

- [ ] **Step 1: Write the function**

```ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  // Best-effort RevenueCat subscriber deletion; never block account removal.
  if (RC_SECRET_KEY) {
    try {
      await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${RC_SECRET_KEY}` } },
      );
    } catch (e) {
      console.warn("[delete-account] RevenueCat delete failed", e);
    }
  }

  // Cascades clear users, coin_ledger, hint_events, and puzzle_completions.
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[delete-account] deleteUser failed", error);
    return json({ error: "delete_failed" }, 500);
  }

  return json({ ok: true });
});
```

- [ ] **Step 2: Deploy and verify the cascade**

```bash
npx supabase functions deploy delete-account
```

Create a test user, give it a ledger entry, call the function with its JWT, then confirm:

```sql
SELECT COUNT(*) FROM users        WHERE id = '<uuid>';       -- 0
SELECT COUNT(*) FROM coin_ledger  WHERE user_id = '<uuid>';  -- 0
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/delete-account/
git commit -m "feat(edge): account deletion for store compliance"
```

---

### Task 12: Client economy service and userStore lockdown

**Files:**
- Create: `services/economyService.ts`
- Modify: `stores/userStore.ts`
- Modify: `services/authService.ts` (remove `ensureUserProfile`, its call sites, and its import)

**Interfaces:**
- Consumes: every RPC and Edge Function above.
- Produces: `spendOnHint`, `payEntryFee`, `claimDailyBonus`, `setDisplayName`, `submitSolve`, `syncPurchases`, `deleteAccount`, `loadEconomyConfig`; and on the store, `refreshBalance()`, `applyServerBalance(n)`. Tasks 13–16 use these.

- [ ] **Step 1: Create `services/economyService.ts`**

```ts
/**
 * economyService.ts — The only place the client talks to the economy.
 *
 * Every function here is a thin wrapper over a server-authoritative RPC or
 * Edge Function. The client never computes, sends, or trusts a coin amount.
 */
import { HintPrices } from "../supabase/functions/_shared/economyTypes";
import { supabase } from "./supabaseClient";

export interface HintChargeResult { balance: number; cost: number; replayed: boolean }
export interface EntryFeeResult   { balance: number; fee: number; replayed: boolean }
export interface DailyBonusResult {
  bonus: number; streak: number; balance: number; already_claimed: boolean;
}
export interface SolveResult {
  score: number; grade: string; coinsEarned: number; newBalance: number;
  accuracy: number; hintsUsed: number; replayed: boolean; verified: boolean;
  breakdown: { base: number; accuracyMultiplier: number; timeMultiplier: number;
               hintPenalty: number; finalScore: number; grade: string };
}

function rpcError(context: string, error: { message: string }): Error {
  const known: Record<string, string> = {
    insufficient_coins: "You don't have enough coins.",
    not_authenticated: "Please sign in again.",
    puzzle_not_found: "That puzzle is no longer available.",
    display_name_length: "Name must be 2–20 characters.",
    display_name_charset: "Name can only use letters, numbers, spaces, - and _.",
    display_name_rejected: "Please choose a different name.",
  };
  const key = Object.keys(known).find((k) => error.message.includes(k));
  return new Error(key ? known[key] : `${context} failed. Please try again.`);
}

export async function spendOnHint(
  puzzleId: string,
  hintType: "reveal_letter" | "reveal_word" | "check_errors",
  actionId: string,
  letterCount = 1,
): Promise<HintChargeResult> {
  const { data, error } = await supabase.rpc("spend_on_hint", {
    p_puzzle_id: puzzleId, p_hint_type: hintType,
    p_action_id: actionId, p_letter_count: letterCount,
  });
  if (error) throw rpcError("Hint", error);
  return data as HintChargeResult;
}

export async function payEntryFee(puzzleId: string): Promise<EntryFeeResult> {
  const { data, error } = await supabase.rpc("pay_entry_fee", {
    p_puzzle_id: puzzleId,
  });
  if (error) throw rpcError("Entry fee", error);
  return data as EntryFeeResult;
}

export async function claimDailyBonus(): Promise<DailyBonusResult> {
  const { data, error } = await supabase.rpc("claim_daily_bonus");
  if (error) throw rpcError("Daily bonus", error);
  return data as DailyBonusResult;
}

export async function setDisplayName(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("set_display_name", { p_name: name });
  if (error) throw rpcError("Rename", error);
  return (data as { display_name: string }).display_name;
}

/** Invokes an Edge Function with the caller's session JWT attached. */
async function invoke<T>(fn: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export function submitSolve(
  puzzleId: string, letters: string, clientElapsedSeconds: number,
): Promise<SolveResult> {
  return invoke<SolveResult>("submit-solve", {
    puzzleId, letters, clientElapsedSeconds,
  });
}

export const syncPurchases = () =>
  invoke<{ credited: number; balance: number }>("sync-purchases", {});

export const deleteAccount = () => invoke<{ ok: boolean }>("delete-account", {});

/** Display-only prices. A charge always uses the server's own number. */
export async function loadHintPrices(): Promise<HintPrices | null> {
  const { data, error } = await supabase
    .from("economy_config").select("value").eq("key", "hint_prices").single();
  if (error || !data) return null;
  return data.value as HintPrices;
}
```

- [ ] **Step 2: Strip coin mutation from `stores/userStore.ts`**

Delete `addCoins`, `spendCoins`, `claimDailyBonus`, and `incrementStreak` from both the `UserState` interface and the implementation. Delete the entire `syncToSupabase` function and its interface entry — the client no longer writes to `users` and the call would now fail.

Replace them with a read path:

```ts
  /** Overwrites the local balance with a server-returned value. */
  applyServerBalance: (coins: number) => void;
  /** Re-reads the authoritative profile. Call after any economy action. */
  refreshBalance: () => Promise<void>;
```

Implementation:

```ts
      applyServerBalance: (coins: number) =>
        set((state) => ({ profile: { ...state.profile, coins } })),

      refreshBalance: async () => {
        const { profile } = get();
        if (!profile.id || profile.id === "guest") return;
        const { data, error } = await supabase
          .from("users")
          .select("coins, total_score, puzzles_solved, current_streak, longest_streak")
          .eq("id", profile.id)
          .maybeSingle();
        if (error || !data) return;
        set((state) => ({
          profile: {
            ...state.profile,
            coins: data.coins,
            totalScore: data.total_score,
            totalPuzzlesSolved: data.puzzles_solved,
            currentStreak: data.current_streak,
            longestStreak: data.longest_streak,
          },
        }));
      },
```

Change `initialProfile.coins` from `200` to `0` — the welcome bonus now arrives from the server trigger, and a local 200 would briefly display a balance the user does not have.

In `completePuzzle`, remove the `totalScore` and `totalPuzzlesSolved` increments; those are server-owned now. Keep the local `categoryStats` rolling averages, which are a client-only convenience.

- [ ] **Step 3: Remove `ensureUserProfile`**

Delete the function from `services/authService.ts` and both call sites (in `signOutAndStartNewAnonSession` and anywhere `_layout.tsx` calls it). The `auth.users` trigger now does this atomically.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in the screens Tasks 13–16 rewrite (`store.tsx`, `[puzzleId].tsx`, `HintOptionsModal.tsx`, `category/[id].tsx`, `collection/index.tsx`, `index.tsx`). Record the list; it is the worklist for the next four tasks.

- [ ] **Step 5: Commit**

```bash
git add services/economyService.ts stores/userStore.ts services/authService.ts
git commit -m "feat(client): server-authoritative economy service; remove client coin mutation"
```

---

### Task 13: Game screen submits to the server

**Files:**
- Modify: `app/game/[puzzleId].tsx`
- Modify: `components/modals/SuccessModal.tsx`
- Modify: `stores/userStore.ts` (pending queue shape)
- Modify: `services/offlineSyncService.ts`
- Modify: `services/puzzleService.ts` (delete `recordCompletion`)

**Interfaces:**
- Consumes: `submitSolve`, `lettersFromGrid`-style serialisation, `applyServerBalance`.
- Produces: a `PendingSolve` queue entry `{ puzzleId, letters, elapsedSeconds, queuedAt }`.

- [ ] **Step 1: Replace the completion pipeline in `app/game/[puzzleId].tsx`**

Delete the `COIN_REWARDS` constant — rewards are server-side now. Replace `handleCompletion` with:

```ts
  const handleCompletion = useCallback(async () => {
    if (!activePuzzle || hasRecorded.current) return;
    hasRecorded.current = true;

    // Serialise the player's letters in the same canonical order the server uses.
    const letters = canonicalCellOrder(activePuzzle.grid)
      .map(({ row, col }) => activePuzzle.grid[row][col].userInput || " ")
      .join("");

    // Show a predicted score immediately so the modal is not empty; it is
    // replaced by the server's authoritative number when it returns.
    const predicted = calculateScore(
      {
        difficulty: activePuzzle.difficulty as Difficulty,
        gridSize: activePuzzle.gridSize,
        accuracy: getAccuracy(),
        timeTaken: timer,
        hintsUsed: activePuzzle.hintsUsed || 0,
      },
      DEFAULT_SCORING_CONFIG,
    );
    setScoreBreakdown(predicted);
    setScoreEarned(predicted.finalScore);
    setRewardPending(true);
    setShowSuccessModal(true);

    if (useSettingsStore.getState().hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    SFX.puzzleComplete();

    try {
      const result = await submitSolve(activePuzzle.id, letters, timer);
      setScoreEarned(result.score);
      setScoreBreakdown(result.breakdown as any);
      setCoinsEarned(result.coinsEarned);
      setRewardPending(false);
      useUserStore.getState().applyServerBalance(result.newBalance);
      completePuzzle(
        activePuzzle.category as any,
        timer,
        Math.round(result.accuracy * activePuzzle.totalWords),
        activePuzzle.totalWords,
        result.score,
      );
      await useUserStore.getState().refreshBalance();
    } catch (err) {
      // Offline or server unreachable: the solve is real, the reward is not
      // yet granted. Queue it and say so plainly rather than inventing coins.
      console.warn("[GameScreen] Submission deferred:", err);
      enqueuePendingSolve({
        puzzleId: activePuzzle.id,
        letters,
        elapsedSeconds: timer,
        queuedAt: new Date().toISOString(),
      });
      setRewardPending(true);
    }

    try {
      const userId = profile.id;
      const categoryPuzzles = await fetchCategoryPuzzles(
        activePuzzle.category as any, userId,
      );
      const next = categoryPuzzles.find(
        (p) => !p.isCompleted && p.id !== activePuzzle.id,
      );
      if (next) setNextPuzzleId(next.id);
    } catch {
      // Non-critical — just won't show "Next Puzzle".
    }
  }, [activePuzzle, timer, profile.id]);
```

Add the imports:

```ts
import { canonicalCellOrder } from "../../supabase/functions/_shared/grid";
import { calculateScore, DEFAULT_SCORING_CONFIG, ScoreBreakdown } from "../../services/scoreEngine";
import { submitSolve } from "../../services/economyService";
```

Add `const [rewardPending, setRewardPending] = useState(false);` alongside the other state, and pass `rewardPending` to `SuccessModal`.

- [ ] **Step 2: Show the pending state in `SuccessModal`**

Add a `rewardPending?: boolean` prop. Where the coin reward is displayed, render:

```tsx
{rewardPending ? (
  <Text style={styles.pendingText}>
    Solved. Your reward will be added when you're back online.
  </Text>
) : (
  <Text style={styles.coinsText}>+{coinsEarned}</Text>
)}
```

Add the style:

```ts
  pendingText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
```

- [ ] **Step 3: Replace the pending queue**

In `stores/userStore.ts`, replace `PendingCompletion` with:

```ts
/** A solve awaiting server submission. Holds no reward figures — the server
 *  decides those when the submission finally lands. */
export interface PendingSolve {
  puzzleId: string;
  letters: string;
  elapsedSeconds: number;
  queuedAt: string;
}
```

Rename `pendingCompletions` → `pendingSolves` and the two actions to
`enqueuePendingSolve` / `dequeuePendingSolve`, keeping the same shape.

Then update the destructure at the top of `app/game/[puzzleId].tsx`, which
currently pulls `addCoins`, `incrementStreak`, `syncToSupabase`, and
`enqueuePendingCompletion` — all four are gone. It should read:

```ts
  const { profile, completePuzzle, enqueuePendingSolve } = useUserStore();
```

- [ ] **Step 4: Rewrite `offlineSyncService.ts`**

```ts
/**
 * offlineSyncService.ts — Drains queued solves.
 *
 * Submissions are idempotent server-side, so a blind retry is always safe.
 */
import { submitSolve } from "./economyService";
import { useUserStore } from "../stores/userStore";

export async function drainPendingSolves(): Promise<number> {
  const { pendingSolves, dequeuePendingSolve, applyServerBalance } =
    useUserStore.getState();
  if (pendingSolves.length === 0) return 0;

  let flushed = 0;
  for (const pending of pendingSolves) {
    try {
      const result = await submitSolve(
        pending.puzzleId, pending.letters, pending.elapsedSeconds,
      );
      applyServerBalance(result.newBalance);
      dequeuePendingSolve(pending.puzzleId);
      flushed++;
    } catch (err) {
      console.warn(`[OfflineSync] Retry failed for ${pending.puzzleId}:`, err);
    }
  }
  return flushed;
}
```

Update the caller in `app/_layout.tsx` from `drainPendingCompletions` to `drainPendingSolves`.

- [ ] **Step 5: Delete `recordCompletion`**

Remove the `recordCompletion` function and the `CompletionData` interface's use as an insert payload from `services/puzzleService.ts`. The client can no longer write that table; leaving the function invites a runtime RLS error.

- [ ] **Step 6: Verify end to end on a device**

Run: `npx expo run:android` (or `run:ios`)
Solve a puzzle. Expected: the modal shows a predicted score instantly, then settles to the server's score and coin reward; the balance in the header updates. Then enable airplane mode and solve another: the modal shows the pending message and no coins. Disable airplane mode, background and foreground the app: the reward arrives.

- [ ] **Step 7: Commit**

```bash
git add app/game/ components/modals/SuccessModal.tsx stores/userStore.ts services/offlineSyncService.ts services/puzzleService.ts app/_layout.tsx
git commit -m "feat(client): server-verified solve submission with honest pending rewards"
```

---

### Task 14: Hints and entry fees through the server

**Files:**
- Modify: `components/modals/HintOptionsModal.tsx`
- Modify: `app/category/[id].tsx:205-270`
- Modify: `app/collection/index.tsx:265-325`

**Interfaces:**
- Consumes: `spendOnHint`, `payEntryFee`, `applyServerBalance`.

- [ ] **Step 1: Fix the charge-then-reveal ordering in `HintOptionsModal.tsx`**

The current handlers reveal first and charge second, so a failed charge still gives away the answer. Replace all three handlers:

```ts
  const [busy, setBusy] = useState(false);

  const charge = async (
    hintType: "reveal_letter" | "reveal_word" | "check_errors",
    letterCount: number,
  ) => {
    if (!activePuzzle) throw new Error("no_puzzle");
    const result = await spendOnHint(
      activePuzzle.id,
      hintType,
      // A stable id per tap makes a retry free instead of double-charged.
      Crypto.randomUUID(),
      letterCount,
    );
    useUserStore.getState().applyServerBalance(result.balance);
    return result;
  };

  const handleRevealLetter = async () => {
    if (!letterEnabled || busy) return;
    setBusy(true);
    try {
      await charge("reveal_letter", 1);   // charge first
      revealLetter();                     // then reveal
      SFX.hint();
      onClose();
    } catch (e: any) {
      Alert.alert("Hint unavailable", e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRevealWord = async () => {
    if (!wordEnabled || busy) return;
    setBusy(true);
    try {
      const unrevealed = activeClue
        ? getUnrevealedLetterCount(activePuzzle!.grid, activeClue)
        : 1;
      await charge("reveal_word", unrevealed);
      revealWord();
      SFX.hint();
      onClose();
    } catch (e: any) {
      Alert.alert("Hint unavailable", e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckErrors = async () => {
    if (!checkEnabled || busy) return;
    setBusy(true);
    try {
      await charge("check_errors", 0);
      checkErrors();
      decrementCheck();
      SFX.error();
      onClose();
    } catch (e: any) {
      Alert.alert("Check unavailable", e.message);
    } finally {
      setBusy(false);
    }
  };
```

Add imports: `Alert` from `react-native`, `useState` from React, `* as Crypto from "expo-crypto"`, `spendOnHint` from `../../services/economyService`, `getUnrevealedLetterCount` from `../../services/hintEngine`. Remove the `spendCoins` destructure from `useUserStore`.

Disable all three buttons while `busy` is true so a double-tap cannot fire two charges.

- [ ] **Step 1b: Show server prices, falling back to the bundled copy**

Per spec decision D5, displayed prices come from config; the constants in
`hintEngine.ts` are only a fallback for when config has not loaded. Add:

```ts
  const [prices, setPrices] = useState<HintPrices | null>(null);
  useEffect(() => { loadHintPrices().then(setPrices); }, []);

  const letterPrice = prices?.reveal_letter ?? REVEAL_LETTER_COST;
  const wordPricePerLetter = prices?.reveal_word_per_letter ?? REVEAL_LETTER_COST;
  const checkPrice = prices?.check_errors ?? CHECK_ERRORS_COST;
```

Use these three values everywhere a price is rendered, and in the
affordability checks. The displayed number never affects the charge — the
server derives that independently — so a stale fallback is cosmetic only.

Import `loadHintPrices` from `../../services/economyService` and `HintPrices`
from `../../supabase/functions/_shared/economyTypes`.

- [ ] **Step 2: Route entry fees through the server**

In `app/category/[id].tsx` around line 213, replace the local fee deduction:

```ts
                    // Server owns the price; a failure must not start the puzzle.
                    try {
                      const { balance } = await payEntryFee(puzzle.id);
                      useUserStore.getState().applyServerBalance(balance);
                    } catch (e: any) {
                      Alert.alert("Not enough coins", e.message);
                      return;
                    }
```

Remove the `spendCoins` destructure and the `ENTRY_FEES` import used for charging. Keep `ENTRY_FEES` only if it still drives the displayed price; prefer reading it from `economy_config` where the display already loads config.

Make the enclosing `onPress` handler `async`.

- [ ] **Step 3: Apply the identical change in `app/collection/index.tsx`**

Around line 282, make the same replacement. The code is the same as Step 2; repeat it rather than extracting a helper, since the two screens differ in their surrounding state.

- [ ] **Step 4: Verify on device**

Buy a letter hint with sufficient coins: the balance drops by exactly 30 and the letter appears. Set your balance to 10 via the SQL editor and try again: an alert appears and **no letter is revealed**. Tap the hint button rapidly five times: exactly one charge lands.

```sql
SELECT COUNT(*) FROM coin_ledger
 WHERE user_id = '<uuid>' AND reason = 'hint_reveal_letter';
```

- [ ] **Step 5: Commit**

```bash
git add components/modals/HintOptionsModal.tsx app/category/ app/collection/
git commit -m "fix(client): charge before revealing; route hints and entry fees through server"
```

---

### Task 15: Store screen without client-side granting

**Files:**
- Modify: `app/(tabs)/store.tsx`

**Interfaces:**
- Consumes: `syncPurchases`, `applyServerBalance`, `coin_products`.

- [ ] **Step 1: Delete the regex grant and add ledger realtime**

Remove `extractCoinsFromId` and every `addCoins` call. Replace `handlePurchase`:

```ts
  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (purchasing) return;
    triggerHaptic();
    setPurchasing(true);
    const balanceBefore = useUserStore.getState().profile.coins;

    const { error, userCancelled } = await purchasePackage(pkg);
    if (userCancelled) { setPurchasing(false); return; }
    if (error) {
      setPurchasing(false);
      Alert.alert("Purchase Failed", error.message);
      return;
    }

    // The store has the money. Coins arrive from the RevenueCat webhook,
    // which we observe via a realtime insert on our own ledger.
    setConfirming(true);
    const granted = await waitForCredit(balanceBefore, 12000);
    setConfirming(false);
    setPurchasing(false);

    if (granted) {
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Purchase complete", "Your coins have been added.");
    } else {
      // Never imply the money is lost — it is not.
      Alert.alert(
        "Purchase received",
        "Your coins are on the way and will appear shortly. " +
          "You can also tap Restore Purchases at any time.",
      );
    }
  };

  /** Resolves true once the balance increases, or false on timeout. */
  const waitForCredit = (before: number, timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        supabase.removeChannel(channel);
        clearTimeout(timer);
        resolve(ok);
      };

      const channel = supabase
        .channel("own_ledger")
        .on(
          "postgres_changes",
          {
            event: "INSERT", schema: "public", table: "coin_ledger",
            filter: `user_id=eq.${useUserStore.getState().profile.id}`,
          },
          (payload: any) => {
            useUserStore.getState().applyServerBalance(payload.new.balance_after);
            if (payload.new.balance_after > before) finish(true);
          },
        )
        .subscribe();

      const timer = setTimeout(async () => {
        // Realtime may have missed it; check directly before giving up.
        await useUserStore.getState().refreshBalance();
        finish(useUserStore.getState().profile.coins > before);
      }, timeoutMs);
    });
```

Add `const [confirming, setConfirming] = useState(false);` and render a "Confirming your purchase…" overlay while it is true.

- [ ] **Step 2: Make Restore Purchases actually restore**

```ts
  const handleRestore = async () => {
    triggerHaptic();
    setPurchasing(true);
    try {
      await restorePurchases();               // syncs the RevenueCat SDK
      const { credited, balance } = await syncPurchases();  // credits anything missed
      useUserStore.getState().applyServerBalance(balance);
      Alert.alert(
        "Purchases restored",
        credited > 0
          ? `${credited} purchase${credited === 1 ? "" : "s"} credited.`
          : "Everything was already up to date.",
      );
    } catch (e: any) {
      Alert.alert("Restore Failed", e.message);
    } finally {
      setPurchasing(false);
    }
  };
```

- [ ] **Step 3: Show coin amounts from the catalogue, not the SKU string**

Load `coin_products` once and look up `pkg.product.identifier`:

```ts
  const [products, setProducts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from("coin_products").select("product_id, coins").then(({ data }) => {
      if (data) {
        setProducts(Object.fromEntries(data.map((p) => [p.product_id, p.coins])));
      }
    });
  }, []);
```

Replace both `extractCoinsFromId(pkg.product.identifier)` call sites with
`products[pkg.product.identifier] ?? 0`.

- [ ] **Step 4: Verify with a sandbox purchase**

Make a sandbox purchase. Expected: the "Confirming" overlay appears, the balance updates within a few seconds, and exactly one ledger row exists:

```sql
SELECT reason, delta, idempotency_key FROM coin_ledger
 WHERE user_id = '<uuid>' AND reason = 'iap_purchase';
```

Then force-quit the app immediately after the store sheet and relaunch: the coins are still credited, because the webhook — not the app — granted them.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/store.tsx
git commit -m "feat(client): webhook-driven coin grants; make Restore Purchases real"
```

---

### Task 16: Leaderboard, stats, daily bonus, and account deletion UI

**Files:**
- Modify: `services/puzzleService.ts` (`fetchLeaderboard`, `getDailyPlayerCount`)
- Modify: `app/(tabs)/index.tsx` (daily bonus, realtime counter)
- Modify: `app/(tabs)/profile.tsx` (delete account)

- [ ] **Step 1: Point the leaderboard at the RPC**

In `services/puzzleService.ts`, replace the `leaderboard_view` query:

```ts
  const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: limit });
```

The returned column names are unchanged, so the mapping below it still applies.

- [ ] **Step 2: Read player counts from `puzzle_stats`**

```ts
export async function getDailyPlayerCount(puzzleId: string): Promise<number> {
  const { data, error } = await supabase
    .from("puzzle_stats")
    .select("players_completed")
    .eq("puzzle_id", puzzleId)
    .maybeSingle();
  if (error) {
    console.warn("[puzzleService] player count failed:", error.message);
    return 0;
  }
  return data?.players_completed ?? 0;
}
```

- [ ] **Step 3: Move the home screen's realtime subscription to `puzzle_stats`**

In `app/(tabs)/index.tsx`, replace the `puzzle_completions` channel with:

```ts
    const subscription = supabase
      .channel("daily_stats")
      .on(
        "postgres_changes",
        {
          event: "UPDATE", schema: "public", table: "puzzle_stats",
          filter: `puzzle_id=eq.${dailyPuzzle.id}`,
        },
        (payload: any) => setDailyPlayerCount(payload.new.players_completed),
      )
      .subscribe();
```

- [ ] **Step 4: Claim the daily bonus from the server**

Replace the mount effect:

```ts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await claimDailyBonus();
        if (cancelled || result.already_claimed || result.bonus === 0) return;
        useUserStore.getState().applyServerBalance(result.balance);
        setDailyBonusBanner(result.bonus);
        setTimeout(() => setDailyBonusBanner(null), 4000);
      } catch {
        // Offline: the bonus is still there tomorrow. Say nothing.
      }
    })();
    return () => { cancelled = true; };
  }, []);
```

Import `claimDailyBonus` from `../../services/economyService`.

- [ ] **Step 5: Add account deletion to the profile screen**

```tsx
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently erases your profile, progress, streak, and remaining " +
        "coins. Purchased coins are not refundable. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              await supabase.auth.signOut();
              useUserStore.getState().resetLocalProfile();
              usePuzzleStore.getState().clearActivePuzzle();
              router.replace("/(auth)/sign-in");
            } catch (e: any) {
              Alert.alert("Could not delete account", e.message);
            }
          },
        },
      ],
    );
  };
```

Render it as a destructive row at the bottom of the settings list:

```tsx
  <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount}>
    <MaterialIcons name="delete-forever" size={20} color="#ef4444" />
    <Text style={styles.dangerText}>Delete Account</Text>
  </TouchableOpacity>
```

```ts
  dangerRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 16, marginTop: 24,
    borderTopWidth: 1, borderTopColor: "rgba(239,68,68,0.2)",
  },
  dangerText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15, color: "#ef4444", fontWeight: "600",
  },
```

- [ ] **Step 6: Verify on device**

The leaderboard populates for accounts with 3+ solves and omits those below. The home counter increments when another device completes the same puzzle. The daily bonus banner appears once per UTC day. Deleting an account returns you to sign-in, and the row is gone from `users`.

- [ ] **Step 7: Commit**

```bash
git add services/puzzleService.ts app/\(tabs\)/
git commit -m "feat(client): safe leaderboard, stats-based counters, account deletion"
```

---

### Task 17: Crash reporting and the analytics funnel

**Files:**
- Create: `services/analyticsService.ts`
- Modify: `app/_layout.tsx`
- Modify: `app.json`

- [ ] **Step 1: Install Sentry**

```bash
npx expo install @sentry/react-native
```

- [ ] **Step 2: Add the plugin to `app.json`**

Add to the `plugins` array:

```json
[
  "@sentry/react-native/expo",
  { "organization": "YOUR_SENTRY_ORG", "project": "cruxe" }
]
```

- [ ] **Step 3: Initialise in `app/_layout.tsx`**

At the very top of the file, before any other import that might throw:

```ts
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
  // Never ship a user's puzzle content or auth tokens to Sentry.
  beforeSend(event) {
    delete event.contexts?.device?.name;
    return event;
  },
});
```

Wrap the default export: `export default Sentry.wrap(RootLayout);`

After auth resolves, attach the id: `Sentry.setUser({ id: userId });`

Add `EXPO_PUBLIC_SENTRY_DSN=` to `.env.example`.

- [ ] **Step 4: Create the analytics service**

```ts
/**
 * analyticsService.ts — A deliberately small funnel.
 *
 * Every event here answers a question sub-projects 2 and 3 will ask.
 * Add nothing that no one has agreed to look at.
 */
import * as Sentry from "@sentry/react-native";

export type AnalyticsEvent =
  | "onboarding_started" | "onboarding_completed"
  | "first_solve"
  | "puzzle_started" | "puzzle_completed" | "puzzle_abandoned"
  | "hint_used"
  | "store_viewed"
  | "purchase_started" | "purchase_completed" | "purchase_failed"
  | "daily_bonus_claimed" | "streak_broken";

export function track(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean> = {},
): void {
  if (__DEV__) {
    console.log("[analytics]", event, properties);
    return;
  }
  Sentry.addBreadcrumb({ category: "analytics", message: event, data: properties });
}
```

> This routes to Sentry breadcrumbs so crashes carry the funnel that preceded them, with no second vendor and no extra consent surface. Swapping in a product-analytics SDK later means changing this one function.

- [ ] **Step 5: Instrument the funnel**

Add `track(...)` calls at exactly these points, and nowhere else:

- `app/(auth)/onboarding.tsx`: `onboarding_started` on mount, `onboarding_completed` in `handleNext`'s final branch.
- `app/game/[puzzleId].tsx`: `puzzle_started` on mount with `{difficulty, gridSize}`; `puzzle_completed` after a successful `submitSolve` with `{score, grade, hintsUsed, timeTaken}`; `puzzle_abandoned` in the unmount cleanup when `!activePuzzle.isComplete`.
- `components/modals/HintOptionsModal.tsx`: `hint_used` after a successful charge with `{hintType, cost}`.
- `app/(tabs)/store.tsx`: `store_viewed` on mount; `purchase_started` / `purchase_completed` / `purchase_failed` in `handlePurchase`.
- `app/(tabs)/index.tsx`: `daily_bonus_claimed` with `{bonus, streak}`.

- [ ] **Step 6: Verify a crash is captured**

Add a temporary throwing button, build a release-mode app, tap it, and confirm the issue appears in Sentry with the preceding breadcrumbs. Remove the button.

- [ ] **Step 7: Commit**

```bash
git add services/analyticsService.ts app/_layout.tsx app.json .env.example package.json package-lock.json
git commit -m "feat: Sentry crash reporting and a minimal analytics funnel"
```

---

### Task 18: Repository hygiene

**Files:**
- Delete: `crash_log.txt`, `crash_buffer.txt`, `crash_log_utf8.txt`, `app/(tabs)/index_full.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: Remove the committed crash logs**

They total roughly 900 KB of tracked noise and may contain device identifiers.

```bash
git rm --cached crash_log.txt crash_buffer.txt crash_log_utf8.txt
rm crash_log.txt crash_buffer.txt crash_log_utf8.txt
```

- [ ] **Step 2: Ignore them in future**

Append to `.gitignore`:

```
# crash dumps
crash_log*.txt
crash_buffer*.txt
```

- [ ] **Step 3: Delete the dead screen**

`app/(tabs)/index_full.tsx` is unreferenced and, under expo-router, an unused file in `app/` still becomes a route.

```bash
git rm "app/(tabs)/index_full.tsx"
```

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all unit and integration tests PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "chore: drop committed crash logs and the dead index_full route"
```

---

## Done criteria

The work is complete when all of the following hold:

1. `npx jest` passes, including every integration test.
2. A client `UPDATE` on `users.coins` fails.
3. A client `INSERT` into `puzzle_completions` fails.
4. A user cannot read another user's `users` or `coin_ledger` row.
5. Solving a puzzle credits coins whose amount appears nowhere in the app bundle.
6. Force-quitting the app immediately after a sandbox purchase still results in exactly one coin grant.
7. Replaying a RevenueCat webhook event produces exactly one `coin_ledger` row.
8. Account deletion removes the auth user and every dependent row.
9. Sentry receives a release-build crash with analytics breadcrumbs attached.
10. `SELECT SUM(delta) FROM coin_ledger WHERE user_id = X` equals `users.coins` for every user.

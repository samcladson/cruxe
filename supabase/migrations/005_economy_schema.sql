-- ============================================================
-- Cruxe Migration 005: Economy schema
-- Server-authoritative currency. See
-- docs/superpowers/specs/2026-08-15-economy-integrity-design.md
-- ============================================================

DO $$ BEGIN
  CREATE TYPE coin_reason AS ENUM (
    'welcome_bonus','daily_bonus','solve_reward','entry_fee',
    'hint_reveal_letter','hint_reveal_word','hint_check_errors',
    'iap_purchase','refund','admin_adjust'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Append-only financial truth. users.coins is the materialised balance.
CREATE TABLE IF NOT EXISTS coin_ledger (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta           INT  NOT NULL CHECK (delta <> 0),
  reason          coin_reason NOT NULL,
  balance_after   INT  NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user
  ON coin_ledger (user_id, created_at DESC);

-- Hint usage, including free actions that move no money.
-- submit_solve derives the hint penalty from here, never from the client.
CREATE TABLE IF NOT EXISTS hint_events (
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
CREATE INDEX IF NOT EXISTS idx_hint_events_user_puzzle
  ON hint_events (user_id, puzzle_id);

-- Runtime-authoritative economy constants. Seeded here; git is the source of truth.
CREATE TABLE IF NOT EXISTS economy_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  version    INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store SKU -> coin amount. Replaces the client-side regex.
CREATE TABLE IF NOT EXISTS coin_products (
  product_id    TEXT PRIMARY KEY,
  coins         INT  NOT NULL CHECK (coins > 0),
  display_name  TEXT NOT NULL,
  bonus_percent INT  NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- Raw purchase events for audit, reconciliation, and replay detection.
CREATE TABLE IF NOT EXISTS iap_events (
  event_id   TEXT PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id TEXT,
  event_type TEXT NOT NULL,
  is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public per-puzzle aggregates. Replaces reading puzzle_completions directly.
CREATE TABLE IF NOT EXISTS puzzle_stats (
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
-- `Infinity` is not valid JSON, so the final time band uses 1e12.
-- resolveTimeMultiplier iterates in order and falls back to the last band,
-- so behaviour is identical.
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

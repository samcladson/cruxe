-- ============================================================
-- Cruxe Database Schema — Daily Puzzle Generation System
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- =========================
-- TABLE: daily_puzzles
-- =========================
-- Stores pre-generated daily puzzles for all category/difficulty/grid combinations.
-- 101 puzzles are generated per day via Edge Function + cron.

CREATE TABLE IF NOT EXISTS daily_puzzles (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  puzzle_date       DATE NOT NULL,
  category          TEXT NOT NULL,
  difficulty        TEXT NOT NULL,
  grid_size         INT  NOT NULL CHECK (grid_size IN (6, 8, 10, 12)),

  -- Variant number: distinguishes multiple puzzles of the same type per day.
  -- Easy & Medium difficulties have multiple variants (2 for 6×6, 2 for 8×8).
  variant           INT NOT NULL DEFAULT 1,

  -- Marks the special daily challenge puzzle (mixed categories, medium, 10×10)
  is_daily_challenge BOOLEAN NOT NULL DEFAULT FALSE,

  -- Full puzzle payload as JSONB (grid, clues, metadata).
  -- Only fetched when the user actually starts playing.
  puzzle_data       JSONB NOT NULL,

  -- Lightweight metadata columns for listing screens.
  -- Avoids loading the full puzzle_data JSONB just to show cards.
  total_words       INT NOT NULL,
  estimated_time    INT NOT NULL,  -- in seconds

  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- One puzzle per unique combination per day
  UNIQUE (puzzle_date, category, difficulty, grid_size, variant)
);

-- Primary lookup: client fetches a specific puzzle by date + filters
CREATE INDEX IF NOT EXISTS idx_dp_lookup
  ON daily_puzzles (puzzle_date, category, difficulty, grid_size);

-- Daily Challenge lookup: fast query for the home screen featured puzzle
CREATE INDEX IF NOT EXISTS idx_dp_daily_challenge
  ON daily_puzzles (puzzle_date, is_daily_challenge)
  WHERE is_daily_challenge = TRUE;

-- Retention cleanup: find puzzles older than N days
CREATE INDEX IF NOT EXISTS idx_dp_date
  ON daily_puzzles (puzzle_date);


-- =========================
-- TABLE: puzzle_completions
-- =========================
-- Lightweight completion records. Each row is ~200 bytes.
-- Denormalized to avoid JOINs on the hot path (profile, history).

CREATE TABLE IF NOT EXISTS puzzle_completions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- User identifier. 'guest' for unauthenticated users,
  -- replaced with auth user ID once auth is implemented.
  user_id         TEXT NOT NULL DEFAULT 'guest',

  -- Reference to the specific puzzle that was completed
  puzzle_id       UUID NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,

  -- Game result stats
  score           INT NOT NULL,
  time_taken      INT NOT NULL,         -- seconds
  accuracy        REAL NOT NULL,        -- 0.0 to 1.0
  hints_used      INT NOT NULL DEFAULT 0,
  coins_earned    INT NOT NULL DEFAULT 0,

  -- Denormalized puzzle metadata (avoids JOINing daily_puzzles for history queries)
  puzzle_date     DATE NOT NULL,
  category        TEXT NOT NULL,
  difficulty      TEXT NOT NULL,
  grid_size       INT NOT NULL,

  completed_at    TIMESTAMPTZ DEFAULT NOW(),

  -- One completion per user per puzzle
  UNIQUE (user_id, puzzle_id)
);

-- User's history and stats (profile screen, ordered by recency)
CREATE INDEX IF NOT EXISTS idx_pc_user
  ON puzzle_completions (user_id, completed_at DESC);

-- Quick check: has this user already completed this puzzle?
CREATE INDEX IF NOT EXISTS idx_pc_lookup
  ON puzzle_completions (user_id, puzzle_id);


-- =========================
-- ROW LEVEL SECURITY
-- =========================

-- Enable RLS on both tables
ALTER TABLE daily_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_completions ENABLE ROW LEVEL SECURITY;

-- daily_puzzles: anyone can read (puzzles are public content)
CREATE POLICY "Anyone can read daily puzzles"
  ON daily_puzzles FOR SELECT
  USING (true);

-- daily_puzzles: only service_role (Edge Functions) can insert/update/delete
CREATE POLICY "Service role can manage daily puzzles"
  ON daily_puzzles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- puzzle_completions: anyone can read (for leaderboards)
CREATE POLICY "Anyone can read completions"
  ON puzzle_completions FOR SELECT
  USING (true);

-- puzzle_completions: anyone can insert their own completion
-- (using user_id from the client for now; will be auth-gated later)
CREATE POLICY "Anyone can insert completions"
  ON puzzle_completions FOR INSERT
  WITH CHECK (true);

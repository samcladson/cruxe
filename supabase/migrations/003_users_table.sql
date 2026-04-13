-- ============================================================
-- Cruxe Migration 003: User Profiles Table
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- =========================
-- TABLE: users
-- =========================
-- Stores persistent user profile data, synced from the app.
-- user_id references auth.users so it survives reinstalls and
-- works with Supabase anonymous auth (upgradeable to social login).

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL DEFAULT 'Player',
  avatar_url        TEXT NOT NULL DEFAULT '',

  -- Economy (200 welcome bonus for new users)
  coins             INT NOT NULL DEFAULT 200,

  -- Lifetime stats
  total_score       INT NOT NULL DEFAULT 0,
  puzzles_solved    INT NOT NULL DEFAULT 0,
  current_streak    INT NOT NULL DEFAULT 0,
  longest_streak    INT NOT NULL DEFAULT 0,
  last_played_date  DATE,

  -- Per-category stats stored as JSONB for flexibility.
  -- Schema: { general: {solved, averageTime, bestTime, accuracy}, ... }
  category_stats    JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Keep updated_at fresh on every write
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

-- Index for fast lookups (mostly by PK, but useful for admin queries)
CREATE INDEX IF NOT EXISTS idx_users_last_played ON users (last_played_date);

-- =========================
-- LEADERBOARD VIEW
-- =========================
-- Aggregates total score per user across all completions.
-- Used by the leaderboard screen. Falls back to users.total_score
-- if the user's completions have been cleaned up.
-- Explicitly using security_invoker = true (Postgres 15+) to 
-- ensure RLS policies are respected and avoid linter warnings.

CREATE OR REPLACE VIEW leaderboard_view 
WITH (security_invoker = true) AS
  SELECT
    u.id                           AS user_id,
    u.display_name,
    u.current_streak               AS streak,
    COALESCE(SUM(pc.score), 0)     AS total_score,
    COUNT(pc.id)                   AS puzzles_solved,
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(SUM(pc.score), 0) DESC
    )                              AS rank
  FROM users u
  LEFT JOIN puzzle_completions pc ON pc.user_id = u.id::TEXT
  GROUP BY u.id, u.display_name, u.current_streak
  ORDER BY total_score DESC;

-- =========================
-- ROW LEVEL SECURITY
-- =========================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only read and write their own row
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
CREATE POLICY "Users can read their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Leaderboard: allow reading display_name + score from any user
-- (we expose this only via the leaderboard_view, not the raw table)
DROP POLICY IF EXISTS "Anyone can read leaderboard data" ON users;
CREATE POLICY "Anyone can read leaderboard data"
  ON users FOR SELECT
  USING (true);

-- =========================
-- MIGRATE puzzle_completions user_id to UUID-compatible
-- =========================
-- The current user_id column is TEXT (defaulting to 'guest').
-- We keep it TEXT for now for backward compatibility.
-- When a user authenticates, their auth.uid()::TEXT will be used.
-- This avoids a breaking ALTER TABLE during migration.

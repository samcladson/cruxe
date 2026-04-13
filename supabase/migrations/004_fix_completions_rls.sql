-- ============================================================
-- Cruxe Migration 004: Fix puzzle_completions RLS
-- Tightens the INSERT policy so users can only insert completions
-- with their own auth.uid(), preventing spoofed submissions.
-- ============================================================

-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Anyone can insert completions" ON puzzle_completions;

-- Replace with auth-gated policy: user_id must match the caller's auth UUID.
-- Supports both authenticated users (auth.uid()::text) and anonymous Supabase
-- sessions (which also receive a real UUID via signInAnonymously).
CREATE POLICY "Users can insert own completions"
  ON puzzle_completions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Also add UPDATE policy so upserts work (the recordCompletion uses upsert)
CREATE POLICY "Users can update own completions"
  ON puzzle_completions FOR UPDATE
  USING (auth.uid()::text = user_id);

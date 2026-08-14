-- ============================================================
-- Cruxe Migration 009: puzzle_completions.user_id TEXT -> UUID
-- Clean slate: no production users exist (see spec decision D8).
-- Removes the u.id::TEXT cast and a class of orphan-row bugs.
-- ============================================================

TRUNCATE TABLE puzzle_completions CASCADE;
TRUNCATE TABLE puzzle_stats CASCADE;

DROP POLICY IF EXISTS "Users read own completions" ON puzzle_completions;

ALTER TABLE puzzle_completions
  ALTER COLUMN user_id TYPE UUID USING user_id::UUID,
  ALTER COLUMN user_id DROP DEFAULT;

ALTER TABLE puzzle_completions
  DROP CONSTRAINT IF EXISTS fk_completions_user;

ALTER TABLE puzzle_completions
  ADD CONSTRAINT fk_completions_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "Users read own completions"
  ON puzzle_completions FOR SELECT
  USING (auth.uid() = user_id);

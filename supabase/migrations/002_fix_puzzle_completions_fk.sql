-- ============================================================
-- SQL Migration: Fix Puzzle Completions Foreign Key
-- Changes ON DELETE CASCADE to ON DELETE SET NULL to preserve
-- user completion history when daily puzzles are cleaned up.
-- ============================================================

-- 1. Drop the existing foreign key constraint
ALTER TABLE IF EXISTS puzzle_completions
DROP CONSTRAINT IF EXISTS puzzle_completions_puzzle_id_fkey;

-- 2. Make puzzle_id nullable (it was NOT NULL initially)
ALTER TABLE puzzle_completions
ALTER COLUMN puzzle_id DROP NOT NULL;

-- 3. Add the foreign key back with ON DELETE SET NULL
ALTER TABLE puzzle_completions
ADD CONSTRAINT puzzle_completions_puzzle_id_fkey
FOREIGN KEY (puzzle_id) 
REFERENCES daily_puzzles(id) 
ON DELETE SET NULL;

-- 4. Update the unique constraint to allow multiple NULL puzzle_ids if needed
-- Actually, the current unique constraint is (user_id, puzzle_id).
-- In Postgres, (user_id, NULL) does not violate a UNIQUE constraint on other (user_id, NULL) rows,
-- but that's what we want: the record of completion is preserved, but it's no longer linked to a specific puzzle row.
-- However, we still have the denormalized fields (puzzle_date, category, difficulty) which are crucial.

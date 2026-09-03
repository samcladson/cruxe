-- ============================================================
-- Cruxe Migration 016: puzzles are about something
--
-- Puzzles were titled by difficulty — EASY, MEDIUM, HARD, EXPERT — which
-- describes a property of the puzzle rather than the puzzle. These columns
-- carry the subject instead: an authored title and standfirst from the
-- checked-in syllabus, and the id of the topic that produced them.
--
-- Every column is nullable and nothing existing is rewritten. Rows generated
-- before this migration keep NULL and the app falls back to the old string,
-- so the rollout is forward-only and needs no backfill — which matters,
-- because a backfill would be one Gemini request per puzzle against a free
-- tier that already spends 19 of its 20 daily requests.
-- ============================================================

ALTER TABLE daily_puzzles
  ADD COLUMN IF NOT EXISTS topic_id   TEXT,
  ADD COLUMN IF NOT EXISTS title      TEXT,
  ADD COLUMN IF NOT EXISTS standfirst TEXT;

COMMENT ON COLUMN daily_puzzles.topic_id IS
  'Syllabus entry that produced this puzzle. Drives topic rotation.';
COMMENT ON COLUMN daily_puzzles.title IS
  'Human-authored subject name from constants/syllabus.ts, never model-generated.';
COMMENT ON COLUMN daily_puzzles.standfirst IS
  'One or two lines under the title, framing why the subject is worth knowing.';

-- The post-solve content (takeaway, per-word facts) lives in
-- puzzle_data.lesson rather than in columns of its own. Listing screens need
-- the title but never the facts, and the whole reason those lightweight
-- columns exist is to avoid loading the full JSONB just to draw a card.

-- ---------- topic rotation ledger ----------
-- Kept separate from daily_puzzles so rotation survives the retention
-- cleanup that deletes old puzzle rows. Without it, a topic would become
-- eligible again as soon as its puzzle aged out.
CREATE TABLE IF NOT EXISTS topic_usage (
  topic_id     TEXT PRIMARY KEY,
  category     TEXT NOT NULL,
  last_used_on DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topic_usage_category
  ON topic_usage (category, last_used_on);

-- Written only by the generator, which runs with the service role.
-- Clients never read or write it; they see the resolved title on the puzzle.
ALTER TABLE topic_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON topic_usage FROM anon, authenticated;

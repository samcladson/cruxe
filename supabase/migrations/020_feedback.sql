-- ============================================================
-- Cruxe Migration 020: user feedback
--
-- Somewhere for players to say what is broken or missing, read from the
-- Supabase dashboard. No third party and no mail provider: a table cannot
-- silently drop a submission the way an unreachable mail API can, and
-- feedback is exactly the thing you do not want to lose quietly.
--
-- Every row is attached to an account, which is now guaranteed — guest play
-- was removed in 019, so there is no anonymous submitter to handle.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Kept in step with FEEDBACK_CATEGORIES in utils/feedbackInput.ts. Adding
  -- one there without adding it here rejects every submission in it.
  category    TEXT NOT NULL CHECK (category IN ('bug', 'idea', 'puzzle', 'other')),
  message     TEXT NOT NULL CHECK (
                char_length(btrim(message)) BETWEEN 1 AND 2000
              ),
  -- Context worth having when someone reports something you cannot
  -- reproduce. Nullable: a submission is worth more than its metadata.
  app_version TEXT,
  platform    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reading is done in the dashboard, so this exists for ordering by recency
-- and for spotting one account submitting repeatedly.
CREATE INDEX IF NOT EXISTS feedback_user_created_idx
  ON feedback (user_id, created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Write-only from the client. A player may submit as themselves and read
-- nothing back — not even their own. Feedback often names other people or
-- quotes support replies, and there is no screen that needs to display it.
DROP POLICY IF EXISTS "Users submit their own feedback" ON feedback;
CREATE POLICY "Users submit their own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No SELECT, UPDATE or DELETE policy exists, so with RLS on, none of those
-- are possible for anon or authenticated. Stated explicitly as well, because
-- a future policy added carelessly would otherwise inherit these grants.
REVOKE SELECT, UPDATE, DELETE ON feedback FROM anon, authenticated;

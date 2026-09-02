-- ============================================================
-- Cruxe Migration 014: streak freeze / repair
--
-- Migration 012 made the daily bonus steeper on purpose: day 14 pays 150
-- coins and keeps climbing. The cost of that is a cliff — one missed day
-- drops the bonus to 30, a ~47% income cut, and streak loss is one of the
-- best-documented churn triggers in daily games.
--
-- This is the safety net. A broken streak can be restored within a grace
-- window, free once a month, then priced. Server-side, so it cannot be
-- forged, and priced from economy_config so it stays tunable.
-- ============================================================

ALTER TYPE coin_reason ADD VALUE IF NOT EXISTS 'streak_repair';

-- The old streak value is lost the moment submit_solve resets it to 1, so
-- capture it at the point of breaking or there is nothing to restore.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS streak_before_break INT,
  ADD COLUMN IF NOT EXISTS streak_broken_on    DATE;

-- Free repairs cannot be counted from coin_ledger, because a free repair
-- moves no money and ledger_apply rejects a zero delta.
CREATE TABLE IF NOT EXISTS streak_repairs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repaired_on  DATE NOT NULL,
  restored_to  INT  NOT NULL,
  cost         INT  NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_streak_repairs_user
  ON streak_repairs (user_id, repaired_on DESC);

ALTER TABLE streak_repairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own repairs" ON streak_repairs;
CREATE POLICY "Users read own repairs"
  ON streak_repairs FOR SELECT USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON streak_repairs FROM authenticated, anon;

-- ---------- config ----------
-- grace_days 2: a streak broken yesterday or the day before can be restored.
-- Beyond that the streak is genuinely gone, and pretending otherwise makes
-- the number meaningless.
UPDATE economy_config
   SET value = '{"repair_cost": 150, "free_repairs_per_month": 1,
                 "grace_days": 2}'::JSONB,
       updated_at = NOW()
 WHERE key = 'streak';

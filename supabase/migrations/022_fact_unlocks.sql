-- ============================================================
-- Cruxe Migration 022: pay to read the facts you did not earn
--
-- **Run 021 first.** It adds the `fact_unlock` value to coin_reason, and
-- Postgres will not let this migration spend with a value added in the same
-- transaction.
--
-- The takeaway screen gives away the fact for every word the player answered
-- correctly, and charges for the rest. The grid must be completely filled
-- before FINISH is offered, so a locked word is a genuine mistake, not a
-- blank. Pre-filled and hint-revealed letters do not lock a word: revealing
-- marks a cell `isPreFilled`, so the grid cannot tell a bought letter from
-- one the generator seeded, and charging for the generator's choices would
-- punish the player for something they never did.
--
-- Priced by difficulty and below reveal_letter (30) on purpose: a fact after
-- the puzzle is curiosity, a letter during it is help, and help costs more.
--
-- ⚠️  The gate is visual. The lesson ships inside puzzle_data, so a locked
--     fact is already on the device before it is paid for. The *spend* is
--     real and server-checked; the *concealment* is not. Stripping locked
--     facts from the payload is the follow-up if that ever matters.
-- ============================================================

INSERT INTO economy_config (key, value) VALUES
  ('fact_unlock', '{"easy": 10, "medium": 20, "hard": 35, "expert": 50}'::JSONB)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = NOW();

-- One row per fact a player has bought, so an unlock is permanent and
-- reopening the screen does not charge again.
CREATE TABLE IF NOT EXISTS fact_unlocks (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id  UUID NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  -- The answer word, which is how the lesson keys its facts.
  answer     TEXT NOT NULL,
  cost       INT  NOT NULL DEFAULT 0,
  -- Same idempotency device as hint_events: a retried or double-tapped
  -- request carries the same id and cannot charge twice.
  action_id  UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, puzzle_id, answer)
);

CREATE INDEX IF NOT EXISTS idx_fact_unlocks_user_puzzle
  ON fact_unlocks (user_id, puzzle_id);

ALTER TABLE fact_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own fact unlocks" ON fact_unlocks;
CREATE POLICY "Users read own fact unlocks"
  ON fact_unlocks FOR SELECT USING (auth.uid() = user_id);

-- Writes go through unlock_fact only, which is SECURITY DEFINER. A client
-- able to insert here directly could award itself free facts.
REVOKE INSERT, UPDATE, DELETE ON fact_unlocks FROM anon, authenticated;

-- ---------- unlock_fact ----------
--
-- Charges for one fact and records it. The price is read from
-- economy_config server-side; nothing about cost comes from the caller.
CREATE OR REPLACE FUNCTION public.unlock_fact(
  p_puzzle_id UUID,
  p_answer    TEXT,
  p_action_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_difficulty TEXT;
  v_cost       INT;
  v_balance    INT;
  v_answer     TEXT := upper(btrim(p_answer));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_answer = '' THEN RAISE EXCEPTION 'missing_answer'; END IF;

  -- Already bought: report the current balance rather than charging again.
  -- This is the re-open case, and it must be free.
  IF EXISTS (
    SELECT 1 FROM fact_unlocks
     WHERE user_id = v_user AND puzzle_id = p_puzzle_id AND answer = v_answer
  ) THEN
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object('cost', 0, 'balance', v_balance,
                              'already_unlocked', TRUE);
  END IF;

  SELECT difficulty INTO v_difficulty
    FROM daily_puzzles WHERE id = p_puzzle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_puzzle'; END IF;

  SELECT (value ->> v_difficulty)::INT INTO v_cost
    FROM economy_config WHERE key = 'fact_unlock';
  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'no_price_for_difficulty: %', v_difficulty;
  END IF;

  -- ledger_apply raises `insufficient_coins` rather than going negative, so
  -- a player who cannot afford this never reaches the INSERT below and the
  -- fact stays locked.
  v_balance := ledger_apply(
    v_user,
    -v_cost,
    'fact_unlock'::coin_reason,
    'fact:' || p_action_id::TEXT,
    jsonb_build_object('puzzle_id', p_puzzle_id, 'answer', v_answer)
  );

  INSERT INTO fact_unlocks (user_id, puzzle_id, answer, cost, action_id)
  VALUES (v_user, p_puzzle_id, v_answer, v_cost, p_action_id);

  RETURN jsonb_build_object('cost', v_cost, 'balance', v_balance,
                            'already_unlocked', FALSE);
END $$;

REVOKE ALL ON FUNCTION public.unlock_fact(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_fact(UUID, TEXT, UUID) TO authenticated;

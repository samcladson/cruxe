-- ============================================================
-- Cruxe Migration 012: economy rebalance
-- See docs/superpowers/specs/2026-09-02-economy-rebalance-design.md
--
-- Replaces an economy that was net-positive on every puzzle (so nobody ever
-- needed to buy coins) and priced reveal-word up to 360 (so nobody ever did).
-- ============================================================

-- Records every puzzle entry, including free ones. The ledger cannot serve
-- this purpose because a free play moves no money.
CREATE TABLE IF NOT EXISTS puzzle_entries (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id  UUID NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,          -- UTC date the entry was granted
  cost       INT  NOT NULL,          -- 0 for free plays and the daily challenge
  was_free   BOOLEAN NOT NULL,       -- TRUE only when an allowance slot was used
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, puzzle_id)
);
CREATE INDEX IF NOT EXISTS idx_entries_user_date
  ON puzzle_entries (user_id, entry_date);

ALTER TABLE puzzle_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own entries" ON puzzle_entries;
CREATE POLICY "Users read own entries"
  ON puzzle_entries FOR SELECT USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON puzzle_entries FROM authenticated, anon;

-- ============================================================
-- CONFIG
-- ============================================================

-- entry_fees is replaced by overflow_fees: a fee now applies only after the
-- free allowance is exhausted, and is 2x the solve reward so that total daily
-- plays come out the same at every difficulty.
DELETE FROM economy_config WHERE key = 'entry_fees';

INSERT INTO economy_config (key, value) VALUES
  ('free_plays',    '{"per_day": 3, "daily_challenge_free": true}'::JSONB),
  ('overflow_fees', '{"easy": 20, "medium": 50, "hard": 100, "expert": 200}'::JSONB),
  -- Placeholder so sub-project 3 can add freeze_cost and grace_days without
  -- restructuring anything.
  ('streak',        '{}'::JSONB)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

UPDATE economy_config
   SET value = '{"coins": 300}'::JSONB, updated_at = NOW()
 WHERE key = 'welcome_bonus';

UPDATE economy_config
   SET value = '{"base": 20, "per_streak_day": 10, "cap": 150}'::JSONB,
       updated_at = NOW()
 WHERE key = 'daily_bonus';

-- reveal_word_per_letter (30 x letters, up to 360) is replaced by a flat
-- price. This kills the cliff and removes the last client-supplied quantity.
UPDATE economy_config
   SET value = '{"reveal_letter": 30, "reveal_word_flat": 120,
                 "check_errors": 20, "free_checks_count": 5}'::JSONB,
       updated_at = NOW()
 WHERE key = 'hint_prices';

-- ============================================================
-- enter_puzzle
-- Replaces pay_entry_fee, which always charged. Entry is now free until the
-- daily allowance runs out; the daily challenge is always free and never
-- consumes a slot.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enter_puzzle(p_puzzle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_today    DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_existing RECORD;
  v_puzzle   RECORD;
  v_per_day  INT;
  v_used     INT;
  v_fee      INT;
  v_balance  INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT (value->>'per_day')::INT INTO v_per_day
    FROM economy_config WHERE key = 'free_plays';
  IF v_per_day IS NULL THEN RAISE EXCEPTION 'missing_config:free_plays'; END IF;

  SELECT COUNT(*) INTO v_used FROM puzzle_entries
   WHERE user_id = v_user AND entry_date = v_today AND was_free;

  -- Re-entry is always free: never punish closing the app mid-solve.
  SELECT cost, was_free INTO v_existing
    FROM puzzle_entries WHERE user_id = v_user AND puzzle_id = p_puzzle_id;
  IF FOUND THEN
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object(
      'cost', 0, 'was_free', v_existing.was_free, 'balance', v_balance,
      'free_plays_remaining', GREATEST(v_per_day - v_used, 0),
      'replayed', TRUE);
  END IF;

  SELECT difficulty, is_daily_challenge INTO v_puzzle
    FROM daily_puzzles WHERE id = p_puzzle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'puzzle_not_found'; END IF;

  -- Daily challenge: free, and outside the allowance entirely.
  IF v_puzzle.is_daily_challenge THEN
    INSERT INTO puzzle_entries (user_id, puzzle_id, entry_date, cost, was_free)
    VALUES (v_user, p_puzzle_id, v_today, 0, FALSE);
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object(
      'cost', 0, 'was_free', FALSE, 'balance', v_balance,
      'free_plays_remaining', GREATEST(v_per_day - v_used, 0),
      'replayed', FALSE);
  END IF;

  -- Within the free allowance.
  IF v_used < v_per_day THEN
    INSERT INTO puzzle_entries (user_id, puzzle_id, entry_date, cost, was_free)
    VALUES (v_user, p_puzzle_id, v_today, 0, TRUE);
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object(
      'cost', 0, 'was_free', TRUE, 'balance', v_balance,
      'free_plays_remaining', GREATEST(v_per_day - v_used - 1, 0),
      'replayed', FALSE);
  END IF;

  -- Overflow. ledger_apply raises insufficient_coins, which rolls back this
  -- whole function - so a refused entry leaves no puzzle_entries row.
  SELECT (value->>v_puzzle.difficulty)::INT INTO v_fee
    FROM economy_config WHERE key = 'overflow_fees';
  IF v_fee IS NULL THEN RAISE EXCEPTION 'missing_config:overflow_fees'; END IF;

  v_balance := ledger_apply(
    v_user, -v_fee, 'entry_fee',
    'entry:' || v_user::TEXT || ':' || p_puzzle_id::TEXT,
    jsonb_build_object('puzzle_id', p_puzzle_id, 'overflow', TRUE));

  INSERT INTO puzzle_entries (user_id, puzzle_id, entry_date, cost, was_free)
  VALUES (v_user, p_puzzle_id, v_today, v_fee, FALSE);

  RETURN jsonb_build_object(
    'cost', v_fee, 'was_free', FALSE, 'balance', v_balance,
    'free_plays_remaining', 0, 'replayed', FALSE);
END;
$$;

-- ============================================================
-- get_play_status
-- Lets the client render remaining plays without computing UTC dates itself.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_play_status()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_today   DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_per_day INT;
  v_used    INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT (value->>'per_day')::INT INTO v_per_day
    FROM economy_config WHERE key = 'free_plays';

  SELECT COUNT(*) INTO v_used FROM puzzle_entries
   WHERE user_id = v_user AND entry_date = v_today AND was_free;

  RETURN jsonb_build_object(
    'free_plays_remaining', GREATEST(COALESCE(v_per_day, 0) - v_used, 0),
    'free_plays_per_day',   COALESCE(v_per_day, 0),
    'resets_at',            ((v_today + 1)::TIMESTAMP AT TIME ZONE 'UTC'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.enter_puzzle(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_play_status()  TO authenticated;

-- pay_entry_fee always charged and had no concept of an allowance.
DROP FUNCTION IF EXISTS public.pay_entry_fee(UUID);

-- ============================================================
-- spend_on_hint (flat word pricing)
-- p_letter_count is gone. It was the only client-supplied quantity left in
-- the economy: a tampered client could under-report it to buy cheap hints.
-- A word now costs a flat price, and the hint penalty is derived from the
-- ratio of the two prices rather than from anything the client says.
-- ============================================================
DROP FUNCTION IF EXISTS public.spend_on_hint(UUID, TEXT, UUID, INT);

CREATE OR REPLACE FUNCTION public.spend_on_hint(
  p_puzzle_id UUID,
  p_hint_type TEXT,
  p_action_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_prices    JSONB;
  v_cost      INT;
  v_reason    coin_reason;
  v_balance   INT;
  v_used_free INT;
  v_letters   INT := 0;
  v_prior     INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_hint_type NOT IN ('reveal_letter','reveal_word','check_errors') THEN
    RAISE EXCEPTION 'unknown_hint_type';
  END IF;

  -- Replay protection: the same tap returns the same answer, charging once.
  SELECT cost INTO v_prior FROM hint_events WHERE action_id = p_action_id;
  IF FOUND THEN
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object('balance', v_balance, 'cost', v_prior,
                              'replayed', TRUE);
  END IF;

  SELECT value INTO v_prices FROM economy_config WHERE key = 'hint_prices';
  IF v_prices IS NULL THEN RAISE EXCEPTION 'missing_config:hint_prices'; END IF;

  IF p_hint_type = 'reveal_letter' THEN
    v_cost    := (v_prices->>'reveal_letter')::INT;
    v_reason  := 'hint_reveal_letter';
    v_letters := 1;

  ELSIF p_hint_type = 'reveal_word' THEN
    v_cost   := (v_prices->>'reveal_word_flat')::INT;
    v_reason := 'hint_reveal_word';
    -- Penalise exactly the number of letters the flat price bought.
    v_letters := GREATEST(
      1, v_cost / NULLIF((v_prices->>'reveal_letter')::INT, 0));

  ELSE -- check_errors
    SELECT COUNT(*) INTO v_used_free
      FROM hint_events
     WHERE user_id = v_user AND puzzle_id = p_puzzle_id
       AND hint_type = 'check_errors';

    IF v_used_free < (v_prices->>'free_checks_count')::INT THEN
      v_cost := 0;
    ELSE
      v_cost := (v_prices->>'check_errors')::INT;
    END IF;
    v_reason := 'hint_check_errors';
  END IF;

  IF v_cost > 0 THEN
    v_balance := ledger_apply(
      v_user, -v_cost, v_reason, 'hint:' || p_action_id::TEXT,
      jsonb_build_object('puzzle_id', p_puzzle_id, 'hint_type', p_hint_type));
  ELSE
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
  END IF;

  INSERT INTO hint_events (user_id, puzzle_id, hint_type, cost,
                           letters_revealed, reported_letter_count, action_id)
  VALUES (v_user, p_puzzle_id, p_hint_type, v_cost, v_letters, NULL,
          p_action_id);

  RETURN jsonb_build_object('balance', v_balance, 'cost', v_cost,
                            'replayed', FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_on_hint(UUID, TEXT, UUID)
  TO authenticated;

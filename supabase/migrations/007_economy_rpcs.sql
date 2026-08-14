-- ============================================================
-- Cruxe Migration 007: economy RPCs
-- The client never sends a price. Every amount is derived here.
-- ============================================================

-- ---------- spend_on_hint ----------
CREATE OR REPLACE FUNCTION public.spend_on_hint(
  p_puzzle_id    UUID,
  p_hint_type    TEXT,
  p_action_id    UUID,
  p_letter_count INT DEFAULT 1
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_prices     JSONB;
  v_cost       INT;
  v_reason     coin_reason;
  v_balance    INT;
  v_used_free  INT;
  v_max_len    INT;
  v_letters    INT := 0;
  v_prior      INT;
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
    -- The client knows how many letters remain; the server bounds the claim
    -- by the longest clue actually in this puzzle. See spec section 6.2.
    SELECT COALESCE(MAX((c->>'length')::INT), 1) INTO v_max_len
      FROM daily_puzzles d,
           LATERAL jsonb_array_elements(d.puzzle_data->'clues') c
     WHERE d.id = p_puzzle_id;

    v_letters := LEAST(GREATEST(COALESCE(p_letter_count, 1), 1),
                       COALESCE(v_max_len, 1));
    v_cost    := (v_prices->>'reveal_word_per_letter')::INT * v_letters;
    v_reason  := 'hint_reveal_word';

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
      jsonb_build_object('puzzle_id', p_puzzle_id, 'hint_type', p_hint_type)
    );
  ELSE
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
  END IF;

  INSERT INTO hint_events (user_id, puzzle_id, hint_type, cost,
                           letters_revealed, reported_letter_count, action_id)
  VALUES (v_user, p_puzzle_id, p_hint_type, v_cost,
          v_letters, p_letter_count, p_action_id);

  RETURN jsonb_build_object('balance', v_balance, 'cost', v_cost,
                            'replayed', FALSE);
END;
$$;

-- ---------- pay_entry_fee ----------
CREATE OR REPLACE FUNCTION public.pay_entry_fee(p_puzzle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user       UUID := auth.uid();
  v_difficulty TEXT;
  v_fee        INT;
  v_balance    INT;
  v_key        TEXT;
  v_existing   INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT difficulty INTO v_difficulty FROM daily_puzzles WHERE id = p_puzzle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'puzzle_not_found'; END IF;

  SELECT (value->>v_difficulty)::INT INTO v_fee
    FROM economy_config WHERE key = 'entry_fees';
  IF v_fee IS NULL THEN RAISE EXCEPTION 'missing_config:entry_fees'; END IF;

  v_key := 'entry:' || v_user::TEXT || ':' || p_puzzle_id::TEXT;

  -- Paying twice for the same puzzle is free; the key already exists.
  SELECT balance_after INTO v_existing
    FROM coin_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
    RETURN jsonb_build_object('balance', v_balance, 'fee', 0, 'replayed', TRUE);
  END IF;

  v_balance := ledger_apply(v_user, -v_fee, 'entry_fee', v_key,
                            jsonb_build_object('puzzle_id', p_puzzle_id));

  RETURN jsonb_build_object('balance', v_balance, 'fee', v_fee,
                            'replayed', FALSE);
END;
$$;

-- ---------- claim_daily_bonus ----------
CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_today   DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_last    DATE;
  v_streak  INT;
  v_cfg     JSONB;
  v_bonus   INT;
  v_balance INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT last_daily_bonus_date, current_streak, coins
    INTO v_last, v_streak, v_balance
    FROM users WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF v_last = v_today THEN
    RETURN jsonb_build_object('bonus', 0, 'streak', v_streak,
                              'balance', v_balance, 'already_claimed', TRUE);
  END IF;

  SELECT value INTO v_cfg FROM economy_config WHERE key = 'daily_bonus';
  IF v_cfg IS NULL THEN RAISE EXCEPTION 'missing_config:daily_bonus'; END IF;

  v_bonus := LEAST(
    (v_cfg->>'cap')::INT,
    (v_cfg->>'base')::INT + COALESCE(v_streak, 0) * (v_cfg->>'per_streak_day')::INT
  );

  v_balance := ledger_apply(
    v_user, v_bonus, 'daily_bonus',
    'daily:' || v_user::TEXT || ':' || v_today::TEXT,
    jsonb_build_object('streak', v_streak)
  );

  UPDATE users SET last_daily_bonus_date = v_today WHERE id = v_user;

  RETURN jsonb_build_object('bonus', v_bonus, 'streak', v_streak,
                            'balance', v_balance, 'already_claimed', FALSE);
END;
$$;

-- ---------- set_display_name ----------
CREATE OR REPLACE FUNCTION public.set_display_name(p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_clean TEXT := TRIM(p_name);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF LENGTH(v_clean) < 2 OR LENGTH(v_clean) > 20 THEN
    RAISE EXCEPTION 'display_name_length';
  END IF;
  -- Letters, digits, spaces, hyphen, underscore, apostrophe.
  IF v_clean !~ '^[A-Za-z0-9 _''-]+$' THEN
    RAISE EXCEPTION 'display_name_charset';
  END IF;
  -- A deliberately small stop-list, not a moderation system. Blocks the
  -- obvious cases at zero cost; real filtering belongs with sub-project 6.
  IF v_clean ~* '(fuck|shit|cunt|nigg|faggot|rape)' THEN
    RAISE EXCEPTION 'display_name_rejected';
  END IF;

  UPDATE users SET display_name = v_clean WHERE id = v_user;
  RETURN jsonb_build_object('display_name', v_clean);
END;
$$;

-- ---------- submit_solve (service role only) ----------
CREATE OR REPLACE FUNCTION public.submit_solve(
  p_user_id       UUID,
  p_puzzle_id     UUID,
  p_accuracy      REAL,
  p_time_seconds  INT,
  p_reported_time INT,
  p_hints_used    INT,
  p_score         INT,
  p_suspect       BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_key      TEXT := 'solve:' || p_user_id::TEXT || ':' || p_puzzle_id::TEXT;
  v_existing RECORD;
  v_puzzle   RECORD;
  v_reward   INT;
  v_balance  INT;
  v_today    DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_last     DATE;
  v_streak   INT;
BEGIN
  -- Replay: return the stored result untouched.
  SELECT score, coins_earned INTO v_existing
    FROM puzzle_completions
   WHERE user_id = p_user_id AND puzzle_id = p_puzzle_id;
  IF FOUND THEN
    SELECT coins INTO v_balance FROM users WHERE id = p_user_id;
    RETURN jsonb_build_object('score', v_existing.score,
                              'coins_earned', v_existing.coins_earned,
                              'balance', v_balance, 'replayed', TRUE);
  END IF;

  SELECT category, difficulty, grid_size, puzzle_date
    INTO v_puzzle FROM daily_puzzles WHERE id = p_puzzle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'puzzle_not_found'; END IF;

  SELECT (value->>v_puzzle.difficulty)::INT INTO v_reward
    FROM economy_config WHERE key = 'solve_rewards';
  IF v_reward IS NULL THEN RAISE EXCEPTION 'missing_config:solve_rewards'; END IF;

  INSERT INTO puzzle_completions (
    user_id, puzzle_id, score, time_taken, accuracy, hints_used,
    coins_earned, puzzle_date, category, difficulty, grid_size,
    suspect, reported_time_seconds
  ) VALUES (
    p_user_id, p_puzzle_id, p_score, p_time_seconds, p_accuracy, p_hints_used,
    v_reward, v_puzzle.puzzle_date, v_puzzle.category, v_puzzle.difficulty,
    v_puzzle.grid_size, p_suspect, p_reported_time
  );

  v_balance := ledger_apply(
    p_user_id, v_reward, 'solve_reward', v_key,
    jsonb_build_object('puzzle_id', p_puzzle_id, 'score', p_score)
  );

  -- Streak: continues if the last play was yesterday, resets otherwise,
  -- and is left alone if the player already played today.
  SELECT last_played_date, current_streak INTO v_last, v_streak
    FROM users WHERE id = p_user_id FOR UPDATE;

  IF v_last IS DISTINCT FROM v_today THEN
    v_streak := CASE WHEN v_last = v_today - 1
                     THEN COALESCE(v_streak, 0) + 1 ELSE 1 END;
  END IF;

  UPDATE users SET
    total_score      = COALESCE(total_score, 0) + p_score,
    puzzles_solved   = COALESCE(puzzles_solved, 0) + 1,
    current_streak   = v_streak,
    longest_streak   = GREATEST(COALESCE(longest_streak, 0), v_streak),
    last_played_date = v_today
  WHERE id = p_user_id;

  RETURN jsonb_build_object('score', p_score, 'coins_earned', v_reward,
                            'balance', v_balance, 'replayed', FALSE);
END;
$$;

-- ---------- credit_purchase (service role only) ----------
CREATE OR REPLACE FUNCTION public.credit_purchase(
  p_user_id    UUID,
  p_product_id TEXT,
  p_event_id   TEXT,
  p_is_refund  BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coins    INT;
  v_key      TEXT;
  v_balance  INT;
  v_existing INT;
BEGIN
  SELECT coins INTO v_coins
    FROM coin_products WHERE product_id = p_product_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_product: %', p_product_id;
  END IF;

  v_key := CASE WHEN p_is_refund THEN 'rc_refund:' ELSE 'rc:' END || p_event_id;

  SELECT balance_after INTO v_existing
    FROM coin_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('coins', v_coins, 'balance', v_existing,
                              'replayed', TRUE);
  END IF;

  v_balance := ledger_apply(
    p_user_id,
    CASE WHEN p_is_refund THEN -v_coins ELSE v_coins END,
    CASE WHEN p_is_refund THEN 'refund'::coin_reason
                          ELSE 'iap_purchase'::coin_reason END,
    v_key,
    jsonb_build_object('product_id', p_product_id, 'event_id', p_event_id),
    p_is_refund   -- refunds may drive the balance negative
  );

  RETURN jsonb_build_object('coins', v_coins, 'balance', v_balance,
                            'replayed', FALSE);
END;
$$;

-- ---------- grants ----------
GRANT EXECUTE ON FUNCTION public.spend_on_hint(UUID, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_entry_fee(UUID)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_bonus()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_display_name(TEXT)               TO authenticated;

REVOKE ALL ON FUNCTION public.submit_solve(UUID, UUID, REAL, INT, INT, INT, INT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_purchase(UUID, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

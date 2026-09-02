-- ============================================================
-- Cruxe Migration 015: streak repair RPCs
--
-- Split from 014 because Postgres refuses to use an enum value in the same
-- transaction that adds it. Run 014 first.
-- ============================================================

-- ---------- submit_solve: remember what was lost ----------
-- Without this the old streak is gone the instant it resets to 1, and there
-- is nothing left to restore.
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
  v_broke    BOOLEAN := FALSE;
  v_old      INT;
BEGIN
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

  SELECT last_played_date, current_streak INTO v_last, v_streak
    FROM users WHERE id = p_user_id FOR UPDATE;

  IF v_last IS DISTINCT FROM v_today THEN
    IF v_last = v_today - 1 THEN
      v_streak := COALESCE(v_streak, 0) + 1;
    ELSE
      -- The streak broke. Capture what it was so repair_streak has something
      -- to restore; a first-ever play (v_last IS NULL) is not a break.
      v_broke := v_last IS NOT NULL AND COALESCE(v_streak, 0) > 0;
      v_old   := COALESCE(v_streak, 0);
      v_streak := 1;
    END IF;
  END IF;

  UPDATE users SET
    total_score      = COALESCE(total_score, 0) + p_score,
    puzzles_solved   = COALESCE(puzzles_solved, 0) + 1,
    current_streak   = v_streak,
    longest_streak   = GREATEST(COALESCE(longest_streak, 0), v_streak),
    last_played_date = v_today,
    streak_before_break =
      CASE WHEN v_broke THEN v_old ELSE streak_before_break END,
    streak_broken_on =
      CASE WHEN v_broke THEN v_today ELSE streak_broken_on END
  WHERE id = p_user_id;

  RETURN jsonb_build_object('score', p_score, 'coins_earned', v_reward,
                            'balance', v_balance, 'replayed', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_solve(UUID, UUID, REAL, INT, INT, INT, INT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

-- ---------- get_streak_status ----------
CREATE OR REPLACE FUNCTION public.get_streak_status()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_today  DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_cfg    JSONB;
  v_u      RECORD;
  v_used   INT;
  v_free   BOOLEAN;
  v_cost   INT;
  v_can    BOOLEAN := FALSE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT value INTO v_cfg FROM economy_config WHERE key = 'streak';
  SELECT current_streak, longest_streak, streak_before_break,
         streak_broken_on, last_played_date
    INTO v_u FROM users WHERE id = v_user;

  SELECT COUNT(*) INTO v_used FROM streak_repairs
   WHERE user_id = v_user
     AND repaired_on >= DATE_TRUNC('month', v_today)::DATE;

  v_free := v_used < COALESCE((v_cfg->>'free_repairs_per_month')::INT, 1);
  v_cost := CASE WHEN v_free THEN 0
                 ELSE COALESCE((v_cfg->>'repair_cost')::INT, 150) END;

  v_can := v_u.streak_broken_on IS NOT NULL
       AND v_u.streak_broken_on >=
           v_today - COALESCE((v_cfg->>'grace_days')::INT, 2)
       AND COALESCE(v_u.streak_before_break, 0) > 1;

  RETURN jsonb_build_object(
    'current_streak',   COALESCE(v_u.current_streak, 0),
    'longest_streak',   COALESCE(v_u.longest_streak, 0),
    'played_today',     v_u.last_played_date = v_today,
    'can_repair',       v_can,
    'repair_cost',      v_cost,
    'repair_is_free',   v_free,
    'restores_to',      COALESCE(v_u.streak_before_break, 0) + 1,
    'broken_on',        v_u.streak_broken_on
  );
END;
$$;

-- ---------- repair_streak ----------
CREATE OR REPLACE FUNCTION public.repair_streak()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_today   DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_cfg     JSONB;
  v_u       RECORD;
  v_used    INT;
  v_cost    INT;
  v_restore INT;
  v_balance INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT value INTO v_cfg FROM economy_config WHERE key = 'streak';

  SELECT current_streak, streak_before_break, streak_broken_on
    INTO v_u FROM users WHERE id = v_user FOR UPDATE;

  IF v_u.streak_broken_on IS NULL THEN
    RAISE EXCEPTION 'no_streak_to_repair';
  END IF;
  IF v_u.streak_broken_on <
     v_today - COALESCE((v_cfg->>'grace_days')::INT, 2) THEN
    RAISE EXCEPTION 'repair_window_expired';
  END IF;
  IF COALESCE(v_u.streak_before_break, 0) <= 1 THEN
    RAISE EXCEPTION 'no_streak_to_repair';
  END IF;

  SELECT COUNT(*) INTO v_used FROM streak_repairs
   WHERE user_id = v_user
     AND repaired_on >= DATE_TRUNC('month', v_today)::DATE;

  v_cost := CASE
    WHEN v_used < COALESCE((v_cfg->>'free_repairs_per_month')::INT, 1) THEN 0
    ELSE COALESCE((v_cfg->>'repair_cost')::INT, 150)
  END;

  -- One repair per break, whatever happens on the client.
  IF v_cost > 0 THEN
    v_balance := ledger_apply(
      v_user, -v_cost, 'streak_repair',
      'repair:' || v_user::TEXT || ':' || v_u.streak_broken_on::TEXT,
      jsonb_build_object('restored_to', v_u.streak_before_break + 1));
  ELSE
    SELECT coins INTO v_balance FROM users WHERE id = v_user;
  END IF;

  v_restore := v_u.streak_before_break + 1;

  UPDATE users SET
    current_streak      = v_restore,
    longest_streak      = GREATEST(COALESCE(longest_streak, 0), v_restore),
    streak_before_break = NULL,
    streak_broken_on    = NULL
  WHERE id = v_user;

  INSERT INTO streak_repairs (user_id, repaired_on, restored_to, cost)
  VALUES (v_user, v_today, v_restore, v_cost);

  RETURN jsonb_build_object('streak', v_restore, 'cost', v_cost,
                            'balance', v_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_streak_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_streak()     TO authenticated;

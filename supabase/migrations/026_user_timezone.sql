-- ============================================================
-- Cruxe Migration 026: player-local days
--
-- Until now "today" was a UTC date everywhere on the server, so a new day began
-- at the same instant for everyone: 5:30 AM for a player in India, 8 PM the
-- evening before for one in New York. Free plays, the daily bonus, streaks and
-- streak repair now use the player's own time zone.
--
-- Design: docs/superpowers/specs/2026-09-28-user-timezone-design.md
--
-- Backward compatible by construction. A user with no stored zone is treated as
-- UTC, which is exactly the old behaviour, so existing users and older app
-- builds are unaffected until an updated app reports a zone.
--
-- Trust rule (enforced in set_timezone, the only writer of the column): the
-- first zone is accepted at once; a later change only if the last change was
-- 3+ days ago. Without it, flipping the phone's zone back and forth would claim
-- the daily bonus and advance a streak several times a day.
--
-- Edge case fixed here: a stored date (last_played_date, last_daily_bonus_date)
-- that is ON OR AFTER today now counts as today. A player west of UTC who played
-- in the evening had a date one day ahead of their local today, which the old
-- equality test read as a broken streak.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone            TEXT,
  ADD COLUMN IF NOT EXISTS timezone_changed_at TIMESTAMPTZ;

-- ─── Helpers (internal: not callable by clients) ─────────────

CREATE OR REPLACE FUNCTION public.user_timezone(p_user UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT timezone FROM users WHERE id = p_user), 'UTC');
$$;

CREATE OR REPLACE FUNCTION public.user_today(p_user UUID)
RETURNS DATE
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE public.user_timezone(p_user))::DATE;
$$;

REVOKE ALL ON FUNCTION public.user_timezone(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_today(UUID)    FROM PUBLIC, anon, authenticated;

-- ─── The one writer ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_timezone(p_zone TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_cur     TEXT;
  v_changed TIMESTAMPTZ;
  v_name    TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT timezone, timezone_changed_at INTO v_cur, v_changed
    FROM users WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  -- An unknown name is ignored rather than rejected: the app reports what the
  -- phone says, and a phone that says something odd must not break sign-in.
  SELECT name INTO v_name FROM pg_timezone_names
   WHERE LOWER(name) = LOWER(COALESCE(p_zone, '')) LIMIT 1;
  IF v_name IS NULL THEN RETURN COALESCE(v_cur, 'UTC'); END IF;

  IF v_cur IS NOT DISTINCT FROM v_name THEN RETURN v_name; END IF;

  IF v_cur IS NULL OR v_changed IS NULL
     OR v_changed <= NOW() - INTERVAL '3 days' THEN
    UPDATE users
       SET timezone = v_name, timezone_changed_at = NOW()
     WHERE id = v_user;
    RETURN v_name;
  END IF;

  RETURN v_cur;
END;
$$;

REVOKE ALL ON FUNCTION public.set_timezone(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_timezone(TEXT) TO authenticated;

-- ─── The six functions that decide "today" ───────────────────
-- Definitions taken from the live database, not the older migration files, and
-- changed only where noted: the v_today line, and the marked comparisons.

CREATE OR REPLACE FUNCTION public.claim_daily_bonus()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user    UUID := auth.uid();
  v_today   DATE := public.user_today(v_user);
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

  IF v_last >= v_today THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.enter_puzzle(p_puzzle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user     UUID := auth.uid();
  v_today    DATE := public.user_today(v_user);
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
$function$;

CREATE OR REPLACE FUNCTION public.get_play_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user    UUID := auth.uid();
  v_today   DATE := public.user_today(v_user);
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
    'resets_at',            ((v_today + 1)::TIMESTAMP AT TIME ZONE public.user_timezone(v_user)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_streak_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user   UUID := auth.uid();
  v_today  DATE := public.user_today(v_user);
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
    'played_today',     v_u.last_played_date >= v_today,
    'can_repair',       v_can,
    'repair_cost',      v_cost,
    'repair_is_free',   v_free,
    'restores_to',      COALESCE(v_u.streak_before_break, 0) + 1,
    'broken_on',        v_u.streak_broken_on
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.repair_streak()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user    UUID := auth.uid();
  v_today   DATE := public.user_today(v_user);
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
$function$;

CREATE OR REPLACE FUNCTION public.submit_solve(p_user_id uuid, p_puzzle_id uuid, p_accuracy real, p_time_seconds integer, p_reported_time integer, p_hints_used integer, p_score integer, p_suspect boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key      TEXT := 'solve:' || p_user_id::TEXT || ':' || p_puzzle_id::TEXT;
  v_existing RECORD;
  v_puzzle   RECORD;
  v_reward   INT;
  v_balance  INT;
  v_today    DATE := public.user_today(p_user_id);
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

  IF v_last IS NULL OR v_last < v_today THEN
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
    last_played_date = GREATEST(COALESCE(v_last, v_today), v_today),
    streak_before_break =
      CASE WHEN v_broke THEN v_old ELSE streak_before_break END,
    streak_broken_on =
      CASE WHEN v_broke THEN v_today ELSE streak_broken_on END
  WHERE id = p_user_id;

  RETURN jsonb_build_object('score', p_score, 'coins_earned', v_reward,
                            'balance', v_balance, 'replayed', FALSE);
END;
$function$;

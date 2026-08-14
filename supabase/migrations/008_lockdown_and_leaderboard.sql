-- ============================================================
-- Cruxe Migration 008: lock the client out of its own economy
-- This is the migration that closes the forgery vulnerabilities.
-- ============================================================

-- ---------- users: read-only to clients ----------
DROP POLICY IF EXISTS "Anyone can read leaderboard data" ON users;  -- the hole
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

REVOKE INSERT, UPDATE, DELETE ON users FROM authenticated, anon;

-- "Users can read their own profile" (auth.uid() = id) from 003 is retained.

-- ---------- profile creation moves to a trigger ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_welcome INT;
BEGIN
  INSERT INTO public.users (id, display_name, coins)
  VALUES (NEW.id, 'Player', 0)
  ON CONFLICT (id) DO NOTHING;

  SELECT (value->>'coins')::INT INTO v_welcome
    FROM economy_config WHERE key = 'welcome_bonus';

  PERFORM ledger_apply(NEW.id, COALESCE(v_welcome, 200), 'welcome_bonus',
                       'welcome:' || NEW.id::TEXT);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- puzzle_completions: service-role write, own-row read ----------
DROP POLICY IF EXISTS "Anyone can read completions"      ON puzzle_completions;
DROP POLICY IF EXISTS "Users can insert own completions" ON puzzle_completions;
DROP POLICY IF EXISTS "Users can update own completions" ON puzzle_completions;

REVOKE INSERT, UPDATE, DELETE ON puzzle_completions FROM authenticated, anon;

CREATE POLICY "Users read own completions"
  ON puzzle_completions FOR SELECT
  USING (auth.uid()::TEXT = user_id::TEXT);

-- ---------- coin_ledger / hint_events: own-row read only ----------
ALTER TABLE coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE hint_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own ledger" ON coin_ledger;
CREATE POLICY "Users read own ledger"
  ON coin_ledger FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own hint events" ON hint_events;
CREATE POLICY "Users read own hint events"
  ON hint_events FOR SELECT USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON coin_ledger, hint_events FROM authenticated, anon;

-- ---------- public config and aggregates ----------
ALTER TABLE economy_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_stats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_events     ENABLE ROW LEVEL SECURITY;  -- no policy = service role only

DROP POLICY IF EXISTS "Anyone reads economy config" ON economy_config;
CREATE POLICY "Anyone reads economy config"
  ON economy_config FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone reads coin products" ON coin_products;
CREATE POLICY "Anyone reads coin products"
  ON coin_products FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone reads puzzle stats" ON puzzle_stats;
CREATE POLICY "Anyone reads puzzle stats"
  ON puzzle_stats FOR SELECT USING (TRUE);

REVOKE INSERT, UPDATE, DELETE
  ON economy_config, coin_products, puzzle_stats, iap_events
  FROM authenticated, anon;

-- ---------- puzzle_stats maintenance ----------
CREATE OR REPLACE FUNCTION public.bump_puzzle_stats()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO puzzle_stats (puzzle_id, players_completed, avg_score, updated_at)
  VALUES (NEW.puzzle_id, 1, NEW.score, NOW())
  ON CONFLICT (puzzle_id) DO UPDATE SET
    avg_score = (
      (puzzle_stats.avg_score * puzzle_stats.players_completed) + NEW.score
    ) / (puzzle_stats.players_completed + 1),
    players_completed = puzzle_stats.players_completed + 1,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_puzzle_stats ON puzzle_completions;
CREATE TRIGGER trg_bump_puzzle_stats
  AFTER INSERT ON puzzle_completions
  FOR EACH ROW EXECUTE FUNCTION public.bump_puzzle_stats();

-- ---------- leaderboard ----------
-- The old view was security_invoker, so it only worked because of the
-- world-readable users policy dropped above. Replaced with a definer
-- function returning an explicit, safe column list.
DROP VIEW IF EXISTS leaderboard_view;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit INT DEFAULT 50)
RETURNS TABLE (
  user_id        UUID,
  display_name   TEXT,
  total_score    INT,
  puzzles_solved INT,
  streak         INT,
  rank           BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.display_name, u.total_score, u.puzzles_solved,
         u.current_streak,
         ROW_NUMBER() OVER (ORDER BY u.total_score DESC, u.id)
    FROM users u
   WHERE u.puzzles_solved >= COALESCE(
           (SELECT (value->>'min_puzzles_solved')::INT
              FROM economy_config WHERE key = 'leaderboard'), 3)
   ORDER BY u.total_score DESC, u.id
   LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT) TO authenticated, anon;

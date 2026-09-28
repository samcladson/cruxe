-- ============================================================
-- Cruxe Migration 027: release hardening
--
-- From the pre-release security audit (2026-09-29). Nothing here changes what
-- the app does; it narrows what a caller holding the public anon key can do.
--
-- 1. The leaderboard no longer publishes account ids. It returned every
--    ranked player's auth UUID to anyone, signed in or not. That UUID is also
--    the RevenueCat app_user_id, and RevenueCat's public SDK key can read a
--    customer's purchase history by it. Each row now carries the caller's own
--    id on their own row (so installed builds still highlight "you") and an
--    opaque hash for everyone else. Signed-in callers only: the app requires
--    an account, so nothing legitimate calls it anonymously.
--
-- 2. Table write privileges are revoked from anon and authenticated. RLS
--    already blocks every write (no write policies exist), but the default
--    Supabase grants included INSERT/UPDATE/DELETE/TRUNCATE, and TRUNCATE is
--    not subject to RLS. All writes go through SECURITY DEFINER functions or
--    the service role, which are unaffected. The single exception is feedback,
--    which signed-in players insert directly.
--
-- 3. Feedback is rate-limited and its free-text side fields are bounded. The
--    message was capped at 2000 characters, but app_version and platform were
--    unbounded, and one account could insert without limit (a known launch
--    gap). The limits are generous for a person and useless for a script.
-- ============================================================

-- ─── 1. Leaderboard without account ids ──────────────────────
-- Changing the id column from UUID to TEXT changes the return type, which
-- CREATE OR REPLACE cannot do.
DROP FUNCTION IF EXISTS public.get_leaderboard(INT);

CREATE FUNCTION public.get_leaderboard(p_limit INT DEFAULT 50)
RETURNS TABLE (
  user_id        TEXT,
  display_name   TEXT,
  total_score    INT,
  puzzles_solved INT,
  streak         INT,
  rank           BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN u.id = auth.uid() THEN u.id::TEXT ELSE md5(u.id::TEXT) END,
         u.display_name, u.total_score, u.puzzles_solved,
         u.current_streak,
         ROW_NUMBER() OVER (ORDER BY u.total_score DESC, u.id)
    FROM users u
   WHERE u.puzzles_solved >= COALESCE(
           (SELECT (value->>'min_puzzles_solved')::INT
              FROM economy_config WHERE key = 'leaderboard'), 3)
   ORDER BY u.total_score DESC, u.id
   LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT) TO authenticated;

-- ─── 2. No direct table writes ───────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated',
      t);
  END LOOP;
END $$;

GRANT INSERT ON public.feedback TO authenticated;

-- Trigger functions cannot be called directly, but they need not be listed
-- as callable either.
REVOKE ALL ON FUNCTION public.bump_puzzle_stats()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_users_updated_at()  FROM PUBLIC, anon, authenticated;

-- ─── 3. Feedback limits ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.feedback_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_recent INT;
BEGIN
  IF char_length(COALESCE(NEW.app_version, '')) > 32
     OR char_length(COALESCE(NEW.platform, '')) > 64 THEN
    RAISE EXCEPTION 'feedback_field_too_long' USING ERRCODE = '22001';
  END IF;

  SELECT COUNT(*) INTO v_recent FROM feedback
   WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '1 hour';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'feedback_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.feedback_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_feedback_guard ON public.feedback;
CREATE TRIGGER trg_feedback_guard
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_guard();

CREATE INDEX IF NOT EXISTS feedback_user_created_idx
  ON public.feedback (user_id, created_at);

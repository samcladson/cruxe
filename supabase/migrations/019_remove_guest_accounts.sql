-- ============================================================
-- Cruxe Migration 019: no more guest accounts
--
-- The app used to sign in anonymously on launch, so every install created a
-- real account with no identity attached, which sign-in later upgraded. That
-- is gone: an account now comes from Google, Apple or an emailed code, and a
-- launch with no session goes to the welcome screen.
--
-- Anonymous rows are therefore unreachable — nobody can ever sign back into
-- one, because there is no credential to sign in with. They are deleted here
-- rather than left as orphans that still count against the economy's
-- aggregates and the leaderboard.
--
-- ⚠️  This is destructive and deliberate. Per the decision recorded with this
--     change, existing anonymous players are wiped rather than migrated.
--     The cascade reaches users, puzzle_completions, coin_ledger,
--     hint_events and iap_events through their FKs to auth.users.
--
-- ⚠️  SQL is not sufficient on its own. Anonymous sign-in must ALSO be turned
--     off in the dashboard: Authentication → Providers → "Allow anonymous
--     sign-ins" → off. Without that the endpoint stays open and a stray
--     client could still mint one.
-- ============================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM auth.users WHERE is_anonymous;

  DELETE FROM auth.users WHERE is_anonymous;

  RAISE NOTICE '019: deleted % anonymous account(s)', v_count;
END $$;

-- ── Leftovers from when user_id was TEXT defaulting to 'guest' ──────────
--
-- Migration 009 already moved puzzle_completions.user_id to UUID with an FK
-- and dropped its default. This is the sweep for anything that kept the old
-- shape, so the guest concept cannot survive in a column definition.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name, column_name, column_default, data_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name = 'user_id'
       AND (column_default ILIKE '%guest%' OR data_type = 'text')
  LOOP
    RAISE WARNING
      '019: %.% is still % (default %) — expected uuid with no default',
      r.table_name, r.column_name, r.data_type, r.column_default;
  END LOOP;
END $$;

-- ============================================================
-- Cruxe Migration 018: publish coin_ledger to realtime
--
-- The store screen does not grant coins. It buys, then waits for the webhook's
-- ledger row to arrive over realtime (waitForCredit in app/(tabs)/store.tsx),
-- with a 12s timeout that falls back to refreshBalance(). That fallback is a
-- safety net, not the happy path — and with coin_ledger absent from the
-- supabase_realtime publication it becomes the ONLY path, so every purchase
-- hangs on "Confirming your purchase" for a full 12 seconds before the coins
-- appear. The purchase is never lost; it just feels broken.
--
-- RLS already restricts this to own-row reads ("Users read own ledger", 008),
-- and realtime enforces that policy for the subscribing user, so publishing
-- the table exposes nothing new.
--
-- Idempotent: the publication may already have been set from the dashboard,
-- and ALTER PUBLICATION ... ADD TABLE errors on a table that is already a
-- member.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname    = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename  = 'coin_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_ledger;
    RAISE NOTICE '018: coin_ledger added to supabase_realtime';
  ELSE
    RAISE NOTICE '018: coin_ledger was already published — no change';
  END IF;
END $$;

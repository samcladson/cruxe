-- ============================================================
-- Cruxe Migration 017: drop the hand-added test SKU
--
-- `test.coins.500` is in the live catalogue but in no migration — it was
-- inserted by hand while wiring up the RevenueCat Test Store. Every other row
-- still matches 011 exactly, so this one row is the whole of the drift between
-- these migrations and the deployed database.
--
-- It is not a shippable product, and it is not inert: store.tsx reads the
-- catalogue without filtering on is_active, so the row is one dashboard typo
-- away from putting a 500-coin card on the store screen at whatever price the
-- offering happens to carry.
--
-- Whether it was ever credited cannot be known from here — iap_events is
-- service-role only, and a Test Store purchase during setup is plausible. So
-- delete it only if nothing ever referenced it, and otherwise deactivate:
-- credit_purchase's lookup in 007 requires is_active, so an inactive row is
-- refused exactly like an unknown SKU, while still explaining what 500 coins
-- meant on any ledger entry that already exists.
-- ============================================================

DO $$
DECLARE
  v_used BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM iap_events  WHERE product_id = 'test.coins.500'
    UNION ALL
    SELECT 1 FROM coin_ledger WHERE metadata->>'product_id' = 'test.coins.500'
  ) INTO v_used;

  IF v_used THEN
    UPDATE coin_products
       SET is_active = FALSE
     WHERE product_id = 'test.coins.500';
    RAISE NOTICE '017: test.coins.500 has history — deactivated, row kept';
  ELSE
    DELETE FROM coin_products WHERE product_id = 'test.coins.500';
    RAISE NOTICE '017: test.coins.500 deleted from the catalogue';
  END IF;
END $$;

-- The catalogue is code, not dashboard state. Anything the store can sell
-- belongs in a migration, because credit_purchase reads coins from this table
-- and an ad-hoc row is an ad-hoc payout.

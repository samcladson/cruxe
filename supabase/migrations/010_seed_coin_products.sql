-- ============================================================
-- Cruxe Migration 010: coin product catalogue
--
-- Maps store SKUs to coin amounts server-side, replacing the old client
-- regex that parsed trailing digits off the product identifier (so
-- "cruxe_pack_v2" granted 2 coins).
--
-- ⚠️  REPLACE THESE product_id VALUES with your real App Store Connect /
--     Play Console product IDs before going live. An unknown SKU is
--     rejected by credit_purchase rather than guessed at, so a mismatch
--     here means a paying customer receives nothing until it is fixed.
-- ============================================================

INSERT INTO coin_products (product_id, coins, display_name, bonus_percent) VALUES
  ('com.cruxe.coins.starter', 500,  'Starter Pack', 0),
  ('com.cruxe.coins.plus',    1200, 'Plus Pack',    20),
  ('com.cruxe.coins.pro',     3000, 'Pro Pack',     50),
  ('com.cruxe.coins.elite',   8000, 'Elite Pack',   100)
ON CONFLICT (product_id) DO UPDATE
  SET coins         = EXCLUDED.coins,
      display_name  = EXCLUDED.display_name,
      bonus_percent = EXCLUDED.bonus_percent;

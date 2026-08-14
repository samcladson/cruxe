-- ============================================================
-- Cruxe Migration 011: four-tier coin ladder + badge control
--
-- Replaces the placeholder catalogue from 010 with the real product IDs.
-- Use these exact strings when creating the products in Play Console (and
-- in App Store Connect later) — matching IDs across platforms keeps this to
-- four rows instead of eight.
--
-- `is_popular` moves the store's "POPULAR" badge out of a hardcoded string
-- match in the app and into config, so the anchor tier can be changed
-- without shipping a build.
-- ============================================================

ALTER TABLE coin_products
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

DELETE FROM coin_products;

INSERT INTO coin_products
  (product_id, coins, display_name, bonus_percent, is_popular, sort_order) VALUES
  ('com.cruxe.coins.starter',   500, 'Starter Pack',  0, FALSE, 1),
  -- Plus is the anchor: the intended default buy. Badging the tier above it
  -- pushes people past their price point rather than toward it.
  ('com.cruxe.coins.plus',     3000, 'Plus Pack',    20, TRUE,  2),
  ('com.cruxe.coins.pro',      6500, 'Pro Pack',     30, FALSE, 3),
  ('com.cruxe.coins.elite',   15000, 'Elite Pack',   50, FALSE, 4);

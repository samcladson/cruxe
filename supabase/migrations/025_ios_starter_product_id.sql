-- ============================================================
-- Cruxe Migration 025: iOS-only Starter Pack product id
--
-- com.cruxe.coins.starter was created in App Store Connect, deleted to fix a
-- typo'd description, and Apple permanently retires a deleted Product ID —
-- it can never be recreated, even under the same app. Android keeps the
-- original id; iOS gets a second one for the same pack.
--
-- This does not touch the purchase flow: the app buys through RevenueCat
-- Packages (Purchases.purchasePackage), never a hardcoded product id, so no
-- client code changes. Only two things read product_id directly and both
-- need this row to recognise the iOS SKU:
--   - app/(tabs)/store.tsx looks up `coin_products` by
--     `pkg.product.identifier` to show the coin amount on the pack card.
--   - the RevenueCat webhook (credit_purchase) looks up the same table by
--     the store's product_id to know how many coins a purchase grants.
--
-- Attach 'com.cruxe.coins.starter2' as the Apple App Store product for the
-- existing "Starter" Package in the RevenueCat dashboard; Android keeps
-- 'com.cruxe.coins.starter' as its Google Play product on that same Package.
-- ============================================================

INSERT INTO coin_products
  (product_id, coins, display_name, bonus_percent, is_popular, sort_order, is_active)
SELECT
  'com.cruxe.coins.starter2', coins, display_name, bonus_percent, is_popular, sort_order, is_active
FROM coin_products
WHERE product_id = 'com.cruxe.coins.starter'
ON CONFLICT (product_id) DO NOTHING;

-- ============================================================
-- Cruxe Migration 023: smaller coin packs
--
-- The packs were sized without reference to what coins are actually spent
-- on. Measured against a regular player's passive income — three free plays
-- plus a free daily challenge, ~190 coins/day earned without spending
-- anything — the old ladder was:
--
--     Starter    500   2.6 days
--     Plus     3,000  15.8 days
--     Pro      6,500  34.2 days
--     Elite   15,000  78.9 days
--
-- Elite was two and a half months of supply. Anyone who bought it was done
-- buying for the quarter, and Plus — the anchor tier — was already past any
-- sensible repurchase cycle. Halving the scale:
--
--     Starter    300   1.6 days
--     Plus     1,800   9.5 days
--     Pro      3,900  20.5 days
--     Elite    9,000  47.4 days
--
-- The per-dollar ladder is unchanged at +0% / +19% / +29% / +49%, which is
-- what bonus_percent records. That ratio has to hold: a larger pack giving
-- less per dollar makes the store look broken, and the first draft of these
-- numbers did exactly that before the arithmetic was checked.
--
-- This is deliberately the *only* lever pulled. The deeper issue is that the
-- economy is net-positive with zero spending, so coins have no scarcity and
-- pack size alone will not create demand. Reducing income would, but it
-- changes the game for players who never intended to spend, and there is no
-- purchase data yet to reason from. Packs are config and reversible in a
-- minute; an income cut is neither.
--
-- No app release needed: the store screen reads coins from this table.
-- ============================================================

UPDATE coin_products SET coins =  300 WHERE product_id = 'com.cruxe.coins.starter';
UPDATE coin_products SET coins = 1800 WHERE product_id = 'com.cruxe.coins.plus';
UPDATE coin_products SET coins = 3900 WHERE product_id = 'com.cruxe.coins.pro';
UPDATE coin_products SET coins = 9000 WHERE product_id = 'com.cruxe.coins.elite';

-- Anything already sold keeps the amount it was sold at: coin_ledger is
-- append-only and credit_purchase reads the price at grant time, so no past
-- purchase is retroactively devalued.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT product_id, coins FROM coin_products ORDER BY sort_order
  LOOP
    RAISE NOTICE '023: % -> % coins', r.product_id, r.coins;
  END LOOP;
END $$;

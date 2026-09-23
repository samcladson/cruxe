-- ============================================================
-- Cruxe Migration 024: five free plays a day
--
-- The daily allowance goes from three puzzles to five, on top of the daily
-- challenge, which stays free and never consumes a slot. enter_puzzle and
-- get_play_status read per_day from this row, so nothing else changes.
-- ============================================================

UPDATE economy_config
   SET value = jsonb_set(value, '{per_day}', '5'::JSONB),
       updated_at = NOW()
 WHERE key = 'free_plays';

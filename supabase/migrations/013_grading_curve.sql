-- ============================================================
-- Cruxe Migration 013: grading curve
--
-- A flawless, hint-free solve was grading C. Two causes:
--
--   1. Expected time was gridSize^2 x factor, parring a medium 10x10 at
--      450s - a strong solver's time treated as average, so most honest
--      solves landed in a penalty band.
--   2. Grade was measured against the theoretical maximum, which assumes
--      blazing speed. That structurally capped an on-pace perfect solve at
--      B; S and A were unreachable without being fast.
--
-- Grade now measures against PAR (on-pace, no hints), and the pace
-- benchmarks are ~40% more generous. Note that accuracy is always exactly 1
-- at scoring time, because submit-solve rejects an incomplete grid outright
-- - so grade reflects only speed and hint use.
-- ============================================================

UPDATE economy_config
   SET value = '{
      "difficultyBase": {"easy": 80, "medium": 180, "hard": 320, "expert": 500},
      "gridMultiplier": {"6": 0.7, "8": 0.85, "10": 1.0, "12": 1.2},
      "timeFactor": {"easy": 4.0, "medium": 6.5, "hard": 9.5, "expert": 13.0},
      "hintPenaltyPerLetter": 8,
      "minimumScore": {"easy": 5, "medium": 10, "hard": 20, "expert": 40},
      "timeMultipliers": [
        {"maxRatio": 0.5,  "multiplier": 1.4},
        {"maxRatio": 0.75, "multiplier": 1.2},
        {"maxRatio": 1.0,  "multiplier": 1.0},
        {"maxRatio": 1.3,  "multiplier": 0.85},
        {"maxRatio": 1.75, "multiplier": 0.7},
        {"maxRatio": 1e12, "multiplier": 0.55}
      ],
      "gradeThresholds": {"s": 1.25, "a": 1.0, "b": 0.8, "c": 0.6}
    }'::JSONB,
       updated_at = NOW()
 WHERE key = 'scoring';

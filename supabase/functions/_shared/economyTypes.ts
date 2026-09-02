/** Value shapes stored in the economy_config table. Shared by Deno and Metro. */

export type Difficulty = "easy" | "medium" | "hard" | "expert";
export type GridSize = 6 | 8 | 10 | 12;

export interface ScoringConfig {
  difficultyBase: Record<Difficulty, number>;
  gridMultiplier: Record<GridSize, number>;
  timeFactor: Record<Difficulty, number>;
  hintPenaltyPerLetter: number;
  minimumScore: Record<Difficulty, number>;
  /** Ordered fastest-first. Ratio is actualTime / expectedTime. */
  timeMultipliers: { maxRatio: number; multiplier: number }[];
  /**
   * Grade cutoffs as a ratio of finalScore to PAR — a solve at the expected
   * pace with no hints. Grading against par rather than the theoretical
   * maximum is what lets an unhurried, unaided solve earn an A; the old
   * denominator assumed blazing speed, so on-pace perfection capped at B.
   */
  gradeThresholds: { s: number; a: number; b: number; c: number };
}

export interface HintPrices {
  reveal_letter: number;
  /** Flat price for a whole word, replacing the old per-letter charge. */
  reveal_word_flat: number;
  check_errors: number;
  free_checks_count: number;
}

export interface TimeBounds {
  /** Floor seconds = cells x perCell + words x perWord. */
  floorPerCellSeconds: number;
  floorPerWordSeconds: number;
  ceilingSeconds: number;
}

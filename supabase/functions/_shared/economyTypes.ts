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
}

export interface HintPrices {
  reveal_letter: number;
  reveal_word_per_letter: number;
  check_errors: number;
  free_checks_count: number;
}

export interface TimeBounds {
  /** Floor seconds = cells x perCell + words x perWord. */
  floorPerCellSeconds: number;
  floorPerWordSeconds: number;
  ceilingSeconds: number;
}

/**
 * scoreEngine.ts — Multi-factor scoring engine for Cruxe.
 *
 * Replaces the old flat accuracy×base formula with a proper competitive
 * scoring system that rewards difficulty, grid scale, speed, and penalises
 * hint usage. Every point should feel genuinely earned.
 *
 * Score formula:
 *   finalScore = clamp(
 *     floor(BASE × GRID_MULTIPLIER × ACCURACY × TIME_MULTIPLIER) − HINT_PENALTY,
 *     minimumScore,
 *     theoreticalMax
 *   )
 */

import { Difficulty, GridSize } from "../types/puzzle.types";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/** Input parameters for score calculation — sourced from puzzle state at completion */
export interface ScoreParams {
  difficulty: Difficulty;
  gridSize: GridSize;
  /** Ratio of correctly filled cells to total fillable cells (0–1) */
  accuracy: number;
  /** Actual time taken to complete, in seconds */
  timeTaken: number;
  /**
   * Total hint actions used. Each revealed letter counts as 1 unit.
   * Matches `puzzle.hintsUsed` from the puzzle state.
   */
  hintsUsed: number;
}

/** Full score breakdown, returned alongside the final score for UI display */
export interface ScoreBreakdown {
  /** Difficulty base × grid multiplier — the raw competitive ceiling */
  base: number;
  /** Per-cell accuracy (0–1), applied as a straight multiplier */
  accuracyMultiplier: number;
  /** Speed ratio multiplier (>1 if fast, <1 if slow) */
  timeMultiplier: number;
  /** Total flat deduction from hints (always a positive number) */
  hintPenalty: number;
  /** Clamped, rounded final score */
  finalScore: number;
  /**
   * Letter grade based on finalScore as a percentage of the theoretical max.
   * S ≥ 90% | A ≥ 75% | B ≥ 55% | C ≥ 35% | D < 35%
   */
  grade: "S" | "A" | "B" | "C" | "D";
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/**
 * Base score for each difficulty level.
 * Expert ceiling before any multipliers is 500, not 250 — elite game, elite stakes.
 */
const DIFFICULTY_BASE: Record<Difficulty, number> = {
  [Difficulty.EASY]: 80,
  [Difficulty.MEDIUM]: 180,
  [Difficulty.HARD]: 320,
  [Difficulty.EXPERT]: 500,
};

/**
 * Grid size multiplier. Larger grids demand more planning and endurance.
 * A 12×12 board earns 20% more than a 10×10 baseline.
 */
const GRID_MULTIPLIER: Record<GridSize, number> = {
  6: 0.7,
  8: 0.85,
  10: 1.0,
  12: 1.2,
};

/**
 * Expected solve time = gridSize² × this factor (seconds).
 * Used to compute how fast/slow the player was relative to a fair benchmark.
 */
const DIFFICULTY_TIME_FACTOR: Record<Difficulty, number> = {
  [Difficulty.EASY]: 3.0,
  [Difficulty.MEDIUM]: 4.5,
  [Difficulty.HARD]: 7.0,
  [Difficulty.EXPERT]: 10.0,
};

/**
 * Flat deduction per letter revealed via a hint action.
 * Applied once per unit in `hintsUsed` (which already counts individual letters).
 */
const HINT_PENALTY_PER_LETTER = 8;

/**
 * Minimum score guaranteed on puzzle completion per difficulty.
 * Even a heavily hinted, slow solve rewards finishing.
 */
const MINIMUM_SCORE: Record<Difficulty, number> = {
  [Difficulty.EASY]: 5,
  [Difficulty.MEDIUM]: 10,
  [Difficulty.HARD]: 20,
  [Difficulty.EXPERT]: 40,
};

// ═══════════════════════════════════════════════════════════════════
// TIME MULTIPLIER
// ═══════════════════════════════════════════════════════════════════

/**
 * Converts the player's actual vs expected solve time ratio into a score multiplier.
 *
 * Ratio = actualTime / expectedTime
 *   ≤ 0.50 → 1.40  (blazing fast — 40% bonus)
 *   ≤ 0.75 → 1.20  (fast — 20% bonus)
 *   ≤ 1.00 → 1.00  (on pace — neutral)
 *   ≤ 1.30 → 0.85  (a little slow — 15% penalty)
 *   ≤ 1.75 → 0.70  (slow — 30% penalty)
 *   > 1.75 → 0.55  (very slow — 45% penalty)
 *
 * @param ratio - actualTime / expectedTime
 * @returns Multiplier to apply to the pre-time score
 */
function resolveTimeMultiplier(ratio: number): number {
  if (ratio <= 0.5) return 1.4;
  if (ratio <= 0.75) return 1.2;
  if (ratio <= 1.0) return 1.0;
  if (ratio <= 1.3) return 0.85;
  if (ratio <= 1.75) return 0.7;
  return 0.55;
}

// ═══════════════════════════════════════════════════════════════════
// GRADE
// ═══════════════════════════════════════════════════════════════════

/**
 * Returns a letter grade based on what percentage of the theoretical max
 * the player achieved. Grades are intended to be rare — an S should feel special.
 *
 * @param finalScore   - The calculated final score
 * @param theoreticalMax - The maximum possible score for this puzzle config
 * @returns Letter grade S / A / B / C / D
 */
function resolveGrade(
  finalScore: number,
  theoreticalMax: number,
): ScoreBreakdown["grade"] {
  if (theoreticalMax <= 0) return "C";
  const ratio = finalScore / theoreticalMax;
  if (ratio >= 0.9) return "S";
  if (ratio >= 0.75) return "A";
  if (ratio >= 0.55) return "B";
  if (ratio >= 0.35) return "C";
  return "D";
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculates the player's score and full breakdown for a completed puzzle.
 *
 * The score reflects all four dimensions of a quality solve:
 *   1. Difficulty × grid size  — how hard was the puzzle?
 *   2. Accuracy                — how many cells were correct?
 *   3. Speed                   — how fast was the solve vs expected?
 *   4. Hints                   — how self-sufficient was the player?
 *
 * @param params - Puzzle completion data from game state
 * @returns ScoreBreakdown with finalScore and all intermediate values
 */
export function calculateScore(params: ScoreParams): ScoreBreakdown {
  const { difficulty, gridSize, accuracy, timeTaken, hintsUsed } = params;

  // ── Step 1: Base (difficulty × grid) ──────────────────────────
  const diffBase = DIFFICULTY_BASE[difficulty];
  const gridMult = GRID_MULTIPLIER[gridSize];
  const base = Math.round(diffBase * gridMult);

  // ── Step 2: Accuracy multiplier ────────────────────────────────
  // Clamped to [0, 1] for safety — accuracy from getAccuracy() is always 0–1
  const accuracyMultiplier = Math.min(1, Math.max(0, accuracy));

  // ── Step 3: Time multiplier ────────────────────────────────────
  const expectedTime = gridSize * gridSize * DIFFICULTY_TIME_FACTOR[difficulty];
  const timeRatio = timeTaken / Math.max(1, expectedTime); // guard div-by-zero
  const timeMultiplier = resolveTimeMultiplier(timeRatio);

  // ── Step 4: Hint penalty ───────────────────────────────────────
  const hintPenalty = hintsUsed * HINT_PENALTY_PER_LETTER;

  // ── Step 5: Compose & clamp ────────────────────────────────────
  const raw =
    Math.floor(base * accuracyMultiplier * timeMultiplier) - hintPenalty;
  const minScore = MINIMUM_SCORE[difficulty];

  // Theoretical max = best multipliers, perfect accuracy, zero hints
  const theoreticalMax = Math.floor(base * 1.0 * 1.4); // accuracy=1, time=blazing
  const finalScore = Math.max(minScore, Math.min(raw, theoreticalMax));

  // ── Step 6: Grade ──────────────────────────────────────────────
  const grade = resolveGrade(finalScore, theoreticalMax);

  return {
    base,
    accuracyMultiplier,
    timeMultiplier,
    hintPenalty,
    finalScore,
    grade,
  };
}

// ═══════════════════════════════════════════════════════════════════
// THEORETICAL MAX HELPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Returns the theoretical maximum score achievable for a given difficulty and grid.
 * Useful for leaderboard relative scoring or progress bars.
 *
 * @param difficulty - Puzzle difficulty
 * @param gridSize   - Puzzle grid size
 * @returns Max achievable score (perfect accuracy, blazing speed, zero hints)
 */
export function getTheoreticalMax(
  difficulty: Difficulty,
  gridSize: GridSize,
): number {
  const base = Math.round(
    DIFFICULTY_BASE[difficulty] * GRID_MULTIPLIER[gridSize],
  );
  return Math.floor(base * 1.4); // 1.0 accuracy × 1.40 time bonus
}

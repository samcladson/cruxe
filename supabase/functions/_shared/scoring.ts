import { Difficulty, GridSize, ScoringConfig } from "./economyTypes.ts";

export interface ScoreParams {
  difficulty: Difficulty;
  gridSize: GridSize;
  /** Ratio of correctly filled cells to total fillable cells (0-1) */
  accuracy: number;
  timeTaken: number;
  hintsUsed: number;
}

export interface ScoreBreakdown {
  base: number;
  accuracyMultiplier: number;
  timeMultiplier: number;
  hintPenalty: number;
  finalScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
}

/**
 * Mirrors the values seeded into economy_config. Used as an offline display
 * fallback only — a charge or an awarded score always uses the DB config.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  difficultyBase: { easy: 80, medium: 180, hard: 320, expert: 500 },
  gridMultiplier: { 6: 0.7, 8: 0.85, 10: 1.0, 12: 1.2 },
  // Expected time is gridSize^2 x factor. The old values parred a medium
  // 10x10 at 450s - a strong solver's time treated as average, which made
  // most honest solves read as "slow".
  timeFactor: { easy: 4.0, medium: 6.5, hard: 9.5, expert: 13.0 },
  hintPenaltyPerLetter: 8,
  minimumScore: { easy: 5, medium: 10, hard: 20, expert: 40 },
  timeMultipliers: [
    { maxRatio: 0.5, multiplier: 1.4 },
    { maxRatio: 0.75, multiplier: 1.2 },
    { maxRatio: 1.0, multiplier: 1.0 },
    { maxRatio: 1.3, multiplier: 0.85 },
    { maxRatio: 1.75, multiplier: 0.7 },
    { maxRatio: Infinity, multiplier: 0.55 },
  ],
  gradeThresholds: { s: 1.25, a: 1.0, b: 0.8, c: 0.6 },
};

function resolveTimeMultiplier(ratio: number, cfg: ScoringConfig): number {
  for (const band of cfg.timeMultipliers) {
    if (ratio <= band.maxRatio) return band.multiplier;
  }
  return cfg.timeMultipliers[cfg.timeMultipliers.length - 1].multiplier;
}

/**
 * Grades a solve against PAR — an on-pace, hint-free solve — rather than
 * against the theoretical maximum, which assumed blazing speed and so
 * structurally capped an unhurried perfect solve at B.
 *
 * Note that accuracy is always exactly 1 here: submit-solve rejects an
 * incomplete grid outright, so any solve that reaches scoring is correct.
 * Grade therefore reflects only speed and hint use.
 *
 * A hint-free solve never drops below B however slow it was. Solving a
 * puzzle unaided is the thing the game is about; taking your time over it
 * is not a failure. It also makes hints the main way a grade falls, so the
 * cost of a hint is felt rather than merely paid.
 */
function resolveGrade(
  finalScore: number,
  par: number,
  hintsUsed: number,
  cfg: ScoringConfig,
): ScoreBreakdown["grade"] {
  if (par <= 0) return "C";
  const ratio = finalScore / par;
  const t = cfg.gradeThresholds;

  let grade: ScoreBreakdown["grade"];
  if (ratio >= t.s) grade = "S";
  else if (ratio >= t.a) grade = "A";
  else if (ratio >= t.b) grade = "B";
  else if (ratio >= t.c) grade = "C";
  else grade = "D";

  if (hintsUsed === 0 && (grade === "C" || grade === "D")) return "B";
  return grade;
}

export function getTheoreticalMax(
  difficulty: Difficulty,
  gridSize: GridSize,
  cfg: ScoringConfig,
): number {
  const base = Math.round(
    cfg.difficultyBase[difficulty] * cfg.gridMultiplier[gridSize],
  );
  const fastest = cfg.timeMultipliers[0].multiplier;
  return Math.floor(base * fastest);
}

export function calculateScore(
  params: ScoreParams,
  cfg: ScoringConfig,
): ScoreBreakdown {
  const { difficulty, gridSize, accuracy, timeTaken, hintsUsed } = params;

  const base = Math.round(
    cfg.difficultyBase[difficulty] * cfg.gridMultiplier[gridSize],
  );
  const accuracyMultiplier = Math.min(1, Math.max(0, accuracy));

  const expectedTime = gridSize * gridSize * cfg.timeFactor[difficulty];
  const timeRatio = timeTaken / Math.max(1, expectedTime);
  const timeMultiplier = resolveTimeMultiplier(timeRatio, cfg);

  const hintPenalty = hintsUsed * cfg.hintPenaltyPerLetter;

  const raw =
    Math.floor(base * accuracyMultiplier * timeMultiplier) - hintPenalty;
  const theoreticalMax = getTheoreticalMax(difficulty, gridSize, cfg);
  const finalScore = Math.max(
    cfg.minimumScore[difficulty],
    Math.min(raw, theoreticalMax),
  );

  return {
    base,
    accuracyMultiplier,
    timeMultiplier,
    hintPenalty,
    finalScore,
    // par = base: on the expected pace, perfectly, with no hints.
    grade: resolveGrade(finalScore, base, hintsUsed, cfg),
  };
}

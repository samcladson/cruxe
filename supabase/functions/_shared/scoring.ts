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
  timeFactor: { easy: 3.0, medium: 4.5, hard: 7.0, expert: 10.0 },
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
};

function resolveTimeMultiplier(ratio: number, cfg: ScoringConfig): number {
  for (const band of cfg.timeMultipliers) {
    if (ratio <= band.maxRatio) return band.multiplier;
  }
  return cfg.timeMultipliers[cfg.timeMultipliers.length - 1].multiplier;
}

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
    grade: resolveGrade(finalScore, theoreticalMax),
  };
}

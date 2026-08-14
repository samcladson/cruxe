import {
  calculateScore,
  getTheoreticalMax,
  DEFAULT_SCORING_CONFIG as CFG,
} from "../supabase/functions/_shared/scoring";

describe("calculateScore", () => {
  it("awards the theoretical max for a perfect, blazing, hint-free solve", () => {
    // medium base 180 x grid 1.0 = 180, time multiplier 1.4.
    // 180 * 1.4 is 251.999... in IEEE 754, so Math.floor yields 251, not 252.
    // The pre-migration scoreEngine had the identical expression, so this
    // preserves shipped behaviour exactly. Do not "fix" it here — changing a
    // score is sub-project 2's decision, not a side effect of this refactor.
    const r = calculateScore(
      { difficulty: "medium", gridSize: 10, accuracy: 1, timeTaken: 10, hintsUsed: 0 },
      CFG,
    );
    expect(r.finalScore).toBe(251);
    expect(r.finalScore).toBe(getTheoreticalMax("medium", 10, CFG));
    expect(r.grade).toBe("S");
  });

  it("subtracts 8 per hint", () => {
    const r = calculateScore(
      { difficulty: "medium", gridSize: 10, accuracy: 1, timeTaken: 10, hintsUsed: 3 },
      CFG,
    );
    expect(r.hintPenalty).toBe(24);
    expect(r.finalScore).toBe(227); // 251 - 24
  });

  it("never returns less than the difficulty minimum", () => {
    const r = calculateScore(
      { difficulty: "expert", gridSize: 12, accuracy: 0.1, timeTaken: 99999, hintsUsed: 50 },
      CFG,
    );
    expect(r.finalScore).toBe(40);
  });

  it("caps at the theoretical max even with absurd inputs", () => {
    const r = calculateScore(
      { difficulty: "easy", gridSize: 6, accuracy: 1, timeTaken: 0, hintsUsed: 0 },
      CFG,
    );
    expect(r.finalScore).toBe(getTheoreticalMax("easy", 6, CFG));
  });

  it("matches the legacy expert 12x12 ceiling of 840", () => {
    expect(getTheoreticalMax("expert", 12, CFG)).toBe(840);
  });
});

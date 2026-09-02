import {
  calculateScore,
  getTheoreticalMax,
  DEFAULT_SCORING_CONFIG as CFG,
} from "../supabase/functions/_shared/scoring";

/** Medium 10x10: base 180, par time 10*10*6.5 = 650s. */
const MEDIUM = { difficulty: "medium" as const, gridSize: 10 as const };

describe("calculateScore", () => {
  it("awards the theoretical max for a perfect, blazing, hint-free solve", () => {
    // base 180 x time 1.4. 180 * 1.4 is 251.999... in IEEE 754, so
    // Math.floor yields 251, not 252. The pre-migration scoreEngine had the
    // identical expression; this preserves shipped behaviour exactly.
    const r = calculateScore(
      { ...MEDIUM, accuracy: 1, timeTaken: 10, hintsUsed: 0 },
      CFG,
    );
    expect(r.finalScore).toBe(251);
    expect(r.finalScore).toBe(getTheoreticalMax("medium", 10, CFG));
    expect(r.grade).toBe("S");
  });

  it("subtracts 8 per hint", () => {
    const r = calculateScore(
      { ...MEDIUM, accuracy: 1, timeTaken: 10, hintsUsed: 3 },
      CFG,
    );
    expect(r.hintPenalty).toBe(24);
    expect(r.finalScore).toBe(227); // 251 - 24
  });

  it("never returns less than the difficulty minimum", () => {
    const r = calculateScore(
      {
        difficulty: "expert",
        gridSize: 12,
        accuracy: 0.1,
        timeTaken: 99999,
        hintsUsed: 50,
      },
      CFG,
    );
    expect(r.finalScore).toBe(40);
  });

  it("matches the legacy expert 12x12 ceiling of 840", () => {
    expect(getTheoreticalMax("expert", 12, CFG)).toBe(840);
  });
});

describe("grading", () => {
  // Grade is measured against PAR (base = 180 for medium 10x10), not the
  // theoretical max. Accuracy is always 1 in practice, because submit-solve
  // rejects an incomplete grid before scoring ever runs.
  const grade = (timeTaken: number, hintsUsed: number) =>
    calculateScore({ ...MEDIUM, accuracy: 1, timeTaken, hintsUsed }, CFG).grade;

  it("gives an unhurried, hint-free solve an A", () => {
    // 600s against a 650s par: on pace, multiplier 1.0, score 180 = par.
    // This is the case that used to come back a demoralising C.
    expect(grade(600, 0)).toBe("A");
  });

  it("reserves S for genuine speed", () => {
    expect(grade(300, 0)).toBe("S"); // <= 50% of par
    expect(grade(480, 0)).toBe("A"); // fast, but not blazing
  });

  it("drops a grade band for hint use", () => {
    // Each hint costs 8 points against a 180 par, so hints are the main
    // thing that moves a grade - which is what makes their cost felt.
    expect(grade(600, 0)).toBe("A"); // 180/180 = 1.00
    expect(grade(600, 3)).toBe("B"); // 156/180 = 0.87
    expect(grade(600, 6)).toBe("C"); // 132/180 = 0.73
  });

  it("never grades a hint-free solve below B, however slow", () => {
    expect(grade(5000, 0)).toBe("B");
    expect(grade(99999, 0)).toBe("B");
  });

  it("does grade below B once hints are involved", () => {
    expect(grade(600, 6)).toBe("C"); // slow-ish and helped
    expect(grade(5000, 10)).toBe("D"); // very slow and heavily helped
  });
});

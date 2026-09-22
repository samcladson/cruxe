import {
  shouldGround,
  countGrounded,
  groundingEnabled,
  monthlyGroundedPrompts,
  MONTHLY_SEARCH_ALLOWANCE,
  GroundableSpec,
} from "../scripts/lib/groundingPolicy";

const spec = (
  variant: number,
  isDailyChallenge = false,
): GroundableSpec => ({ variant, isDailyChallenge });

/** The manifest the free-tier generator builds: 15 category + 3 wildcard + 1 challenge. */
const dailyManifest: GroundableSpec[] = [
  ...Array.from({ length: 15 }, () => spec(1)),
  ...Array.from({ length: 3 }, () => spec(2)),
  spec(1, true),
];

describe("groundingEnabled", () => {
  it("is off when unset", () => {
    // The default must be off: a free-tier project has no search quota at
    // all, so guessing wrong 429s every grounded puzzle in the run.
    expect(groundingEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("is on for 1 or true", () => {
    expect(groundingEnabled({ GEMINI_GROUNDING: "1" } as any)).toBe(true);
    expect(groundingEnabled({ GEMINI_GROUNDING: "true" } as any)).toBe(true);
  });

  it("is off for anything else", () => {
    expect(groundingEnabled({ GEMINI_GROUNDING: "0" } as any)).toBe(false);
    expect(groundingEnabled({ GEMINI_GROUNDING: "yes" } as any)).toBe(false);
  });
});

describe("shouldGround", () => {
  it("grounds nothing while grounding is disabled", () => {
    for (const s of dailyManifest) expect(shouldGround(s, false)).toBe(false);
  });

  it("grounds the Daily Challenge when enabled", () => {
    expect(shouldGround(spec(1, true), true)).toBe(true);
  });

  it("grounds the wildcards when enabled", () => {
    expect(shouldGround(spec(2), true)).toBe(true);
  });

  it("does not ground the fixed category rotation", () => {
    // Variant 1 takes its subject from the syllabus, which does not go stale
    // the way a clue about this week's news does.
    expect(shouldGround(spec(1), true)).toBe(false);
  });
});

describe("grounded volume", () => {
  it("counts zero while disabled", () => {
    expect(countGrounded(dailyManifest, false)).toBe(0);
  });

  it("grounds exactly four puzzles in a day's manifest when enabled", () => {
    expect(countGrounded(dailyManifest, true)).toBe(4);
  });

  it("stays well inside the monthly search allowance", () => {
    // The check that matters: even assuming a generous five searches per
    // grounded prompt, a month of runs must not approach the free allowance.
    const prompts = monthlyGroundedPrompts(countGrounded(dailyManifest, true));
    expect(prompts * 5).toBeLessThan(MONTHLY_SEARCH_ALLOWANCE);
  });

  it("counts nothing when a run has no puzzles left to generate", () => {
    expect(countGrounded([], true)).toBe(0);
  });
});

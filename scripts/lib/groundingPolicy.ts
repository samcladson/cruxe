/**
 * Decides which puzzles are generated with Google Search grounding.
 *
 * Grounding is what makes a clue about "right now" actually about right now.
 * Without it the model can only draw on training data, so a prompt that asks
 * for what is trending today gets either stale material presented as current
 * or an invention that reads plausibly and is false — the second being much
 * the worse outcome for an app that ships a `fact` alongside every answer.
 *
 * ─── Currently OFF, and not by choice ───────────────────────────────────
 * Grounded search is metered separately from the request quota, and on a
 * free-tier project that meter reads zero: sending `tools: [{google_search}]`
 * returns 429 RESOURCE_EXHAUSTED on the first call of the day, against an
 * otherwise untouched quota. The documented allowance of 5,000 searches per
 * month across the 3.x models needs a billing-enabled project. Verified
 * against the live API on 2026-09-23.
 *
 * So `GEMINI_GROUNDING` defaults off and the policy below is what switches on
 * the day billing is enabled — one environment variable, no code change.
 *
 * It is deliberately not "ground everything" even then, because the model
 * decides how many searches to run per prompt: one puzzle is not one search.
 * Grounding the four puzzles a day that most need currency costs roughly 120
 * prompts a month, which stays inside the allowance even if each fires
 * several searches, and leaves room to widen the rule once real usage is
 * visible.
 */

/** The fields of a puzzle spec the grounding decision depends on. */
export interface GroundableSpec {
  /** 1 for the fixed category rotation, 2 for the day's wildcards. */
  variant: number;
  isDailyChallenge: boolean;
}

/** Grounded search requests per month on a billed project, across 3.x models. */
export const MONTHLY_SEARCH_ALLOWANCE = 5000;

/**
 * Whether grounding is permitted at all for this run.
 *
 * Reads the environment rather than taking a constant so that enabling it is
 * a deploy-time decision. Off unless explicitly set, because the failure mode
 * of guessing wrong is every grounded puzzle 429ing.
 */
export function groundingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GEMINI_GROUNDING === "1" || env.GEMINI_GROUNDING === "true";
}

/**
 * True when this puzzle should be generated with Google Search grounding.
 *
 * The Daily Challenge is the one puzzle every player sees, so it carries the
 * most weight when it feels dated. The wildcards (variant 2) exist to vary
 * the day's collection, which is precisely where topical material belongs.
 * The fixed category rotation (variant 1) leans on the syllabus for its
 * subject matter and does not need the live web to be good.
 */
export function shouldGround(spec: GroundableSpec, enabled: boolean): boolean {
  if (!enabled) return false;
  return spec.isDailyChallenge || spec.variant === 2;
}

/**
 * How many prompts in a run will be grounded. Logged before generation so a
 * change to the manifest that quietly multiplies grounded calls is visible in
 * the run output rather than discovered on a bill.
 */
export function countGrounded(
  specs: GroundableSpec[],
  enabled: boolean,
): number {
  return specs.filter((s) => shouldGround(s, enabled)).length;
}

/**
 * Rough monthly prompt count at a given per-day rate, for the same warning.
 * Deliberately counts prompts, not searches: the true search count is only
 * knowable after the fact, so this is the floor, not the estimate.
 */
export function monthlyGroundedPrompts(groundedPerDay: number): number {
  return groundedPerDay * 30;
}

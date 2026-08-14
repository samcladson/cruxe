/**
 * scoreEngine.ts — Client-facing re-export of the canonical scoring module.
 *
 * The formula lives at supabase/functions/_shared/scoring.ts so the Edge
 * Function that awards scores and the client that previews them cannot drift.
 * Do not add logic here.
 */
export {
  calculateScore,
  getTheoreticalMax,
  DEFAULT_SCORING_CONFIG,
} from "../supabase/functions/_shared/scoring";
export type {
  ScoreParams,
  ScoreBreakdown,
} from "../supabase/functions/_shared/scoring";

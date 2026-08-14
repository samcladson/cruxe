import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifySubmission } from "../_shared/grid.ts";
import { calculateScore } from "../_shared/scoring.ts";
import { loadScoring, loadTimeBounds } from "../_shared/config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1. Identity comes from the verified JWT. The body never carries a user id.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  let body: {
    puzzleId?: string;
    letters?: string;
    clientElapsedSeconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const { puzzleId, letters, clientElapsedSeconds } = body;
  if (
    !puzzleId ||
    typeof letters !== "string" ||
    typeof clientElapsedSeconds !== "number" ||
    !Number.isFinite(clientElapsedSeconds)
  ) {
    return json({ error: "bad_request" }, 400);
  }

  // 2. Load the stored grid — the answer key the server owns.
  const { data: puzzle, error: pErr } = await admin
    .from("daily_puzzles")
    .select("id, difficulty, grid_size, puzzle_data")
    .eq("id", puzzleId)
    .single();
  if (pErr || !puzzle) return json({ error: "puzzle_not_found" }, 404);

  const storedGrid = puzzle.puzzle_data?.grid;
  if (!storedGrid) return json({ error: "puzzle_not_verifiable" }, 409);

  // 3. Verify the submission against the answer key.
  let result;
  try {
    result = verifySubmission(storedGrid, letters);
  } catch {
    return json({ error: "length_mismatch" }, 400);
  }
  if (!result.isComplete) return json({ error: "incomplete_solve" }, 422);

  // 4. Hints come from the server's own records, never the client's.
  //    The penalty is per *letter* revealed, so a reveal-word that uncovered
  //    eight letters must count as eight — hence summing letters_revealed
  //    rather than counting rows.
  const { data: hintRows } = await admin
    .from("hint_events")
    .select("letters_revealed")
    .eq("user_id", userId)
    .eq("puzzle_id", puzzleId);
  const hintsUsed = (hintRows ?? []).reduce(
    (sum, r) => sum + (r.letters_revealed ?? 0),
    0,
  );

  // 5. Clamp the one client-supplied quantity.
  const bounds = await loadTimeBounds(admin);
  const floor = Math.ceil(
    result.totalCells * bounds.floorPerCellSeconds +
      (puzzle.puzzle_data?.metadata?.totalWords ?? 0) *
        bounds.floorPerWordSeconds,
  );
  const reported = Math.max(0, Math.floor(clientElapsedSeconds));
  const suspect = reported < floor;
  const timeTaken = Math.min(Math.max(reported, floor), bounds.ceilingSeconds);

  // 6. Recompute the score. The client's claim is not in the payload at all.
  const scoring = await loadScoring(admin);
  const breakdown = calculateScore(
    {
      difficulty: puzzle.difficulty,
      gridSize: puzzle.grid_size,
      accuracy: result.accuracy,
      timeTaken,
      hintsUsed,
    },
    scoring,
  );

  // 7. Award, idempotently.
  const { data: awarded, error: awardErr } = await admin.rpc("submit_solve", {
    p_user_id: userId,
    p_puzzle_id: puzzleId,
    p_accuracy: result.accuracy,
    p_time_seconds: timeTaken,
    p_reported_time: reported,
    p_hints_used: hintsUsed,
    p_score: breakdown.finalScore,
    p_suspect: suspect,
  });
  if (awardErr) {
    console.error("[submit-solve] award failed", awardErr);
    return json({ error: "award_failed" }, 500);
  }

  return json({
    score: awarded.score,
    grade: breakdown.grade,
    breakdown,
    coinsEarned: awarded.coins_earned,
    newBalance: awarded.balance,
    accuracy: result.accuracy,
    hintsUsed,
    replayed: awarded.replayed,
    verified: true,
  });
});

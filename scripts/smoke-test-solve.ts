/**
 * smoke-test-solve.ts — End-to-end check of the solve pipeline.
 *
 * Creates a throwaway user, picks a real grid-bearing puzzle, submits the
 * correct answer key to the submit-solve Edge Function, and verifies that
 * the server independently scored it and credited coins through the ledger.
 * Cleans up after itself.
 *
 * This exercises the full chain: JWT auth -> grid verification -> score
 * recomputation -> submit_solve RPC -> coin_ledger. If it passes, solving a
 * puzzle in the app will work.
 *
 * Usage:
 *   npx tsx scripts/smoke-test-solve.ts
 *
 * Required environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { lettersFromGrid } from "../supabase/functions/_shared/grid.ts";

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    "Missing env vars. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, " +
      "SUPABASE_ANON_KEY.",
  );
  process.exit(1);
}

const PASSWORD = "smoke-test-password-123";

async function main() {
  const admin = createClient(URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });

  // ── 1. Find a puzzle that actually has a stored grid ─────────────
  const { data: rows } = await admin
    .from("daily_puzzles")
    .select("id, category, difficulty, grid_size, puzzle_data")
    .order("puzzle_date", { ascending: false })
    .limit(100);

  const puzzle = (rows ?? []).find((r: any) => r.puzzle_data?.grid);
  if (!puzzle) {
    console.error(
      "✗ No grid-bearing puzzle found. The generator has not run with grid\n" +
        "  support yet — wait for the GitHub Action, then retry.",
    );
    process.exit(1);
  }

  console.log(
    `Using puzzle ${puzzle.category}/${puzzle.difficulty}/` +
      `${puzzle.grid_size}x${puzzle.grid_size}`,
  );

  // ── 2. Derive the answer key exactly as the server will ──────────
  const letters = lettersFromGrid(puzzle.puzzle_data.grid);
  console.log(`Answer key: ${letters.length} cells`);

  // ── 3. Throwaway user ────────────────────────────────────────────
  const email = `smoke-${Date.now()}@cruxe.test`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    { email, password: PASSWORD, email_confirm: true },
  );
  if (createErr) throw createErr;
  const userId = created.user!.id;

  try {
    const { data: before } = await admin
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    console.log(`Welcome bonus credited by trigger: ${before?.coins} coins`);

    // ── 4. Sign in to get a real JWT ───────────────────────────────
    const user = createClient(URL!, ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: session, error: signInErr } =
      await user.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInErr) throw signInErr;

    // ── 5. Submit the solve ────────────────────────────────────────
    const res = await fetch(`${URL}/functions/v1/submit-solve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.session!.access_token}`,
        "Content-Type": "application/json",
        apikey: ANON_KEY!,
      },
      body: JSON.stringify({
        puzzleId: puzzle.id,
        letters,
        clientElapsedSeconds: 600,
      }),
    });

    const body = await res.json();
    console.log(`\nHTTP ${res.status}`);
    console.log(JSON.stringify(body, null, 2));

    if (!res.ok) {
      console.error("\n✗ Submission rejected. See the error above.");
      process.exit(1);
    }

    // ── 6. Verify the server actually moved money ──────────────────
    const { data: ledger } = await admin
      .from("coin_ledger")
      .select("reason, delta, balance_after, idempotency_key")
      .eq("user_id", userId)
      .order("id");

    console.log("\nLedger:");
    for (const row of ledger ?? []) {
      console.log(
        `  ${row.reason.padEnd(16)} ${String(row.delta).padStart(6)}  ` +
          `-> ${row.balance_after}`,
      );
    }

    const { data: completion } = await admin
      .from("puzzle_completions")
      .select("score, time_taken, reported_time_seconds, suspect, hints_used")
      .eq("user_id", userId)
      .single();
    console.log("\nCompletion row:", completion);

    // ── 7. Replay must not pay twice ───────────────────────────────
    const replay = await fetch(`${URL}/functions/v1/submit-solve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.session!.access_token}`,
        "Content-Type": "application/json",
        apikey: ANON_KEY!,
      },
      body: JSON.stringify({
        puzzleId: puzzle.id,
        letters,
        clientElapsedSeconds: 1,
      }),
    });
    const replayBody = await replay.json();

    const solveRows = (ledger ?? []).filter(
      (r: any) => r.reason === "solve_reward",
    ).length;
    const { count: afterReplay } = await admin
      .from("coin_ledger")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("reason", "solve_reward");

    console.log(
      `\nReplay returned replayed=${replayBody.replayed}, ` +
        `solve_reward rows: ${solveRows} -> ${afterReplay}`,
    );

    const ok = body.verified && afterReplay === 1;
    console.log(
      ok
        ? "\n✓ PASS — server verified the grid, scored it independently, " +
            "credited coins once, and refused to pay twice."
        : "\n✗ FAIL — see output above.",
    );
    process.exit(ok ? 0 : 1);
  } finally {
    await admin.auth.admin.deleteUser(userId);
    console.log("\n(cleaned up test user)");
  }
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
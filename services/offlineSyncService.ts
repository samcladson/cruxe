/**
 * offlineSyncService.ts — Drains queued solves.
 *
 * A solve that could not reach the server is queued rather than rewarded
 * locally, so there is never an optimistic coin figure for the server to
 * contradict. Submission is idempotent server-side (keyed
 * `solve:{user}:{puzzle}`), so a blind retry is always safe.
 *
 * Call `drainPendingSolves()` from the root layout's AppState listener.
 */

import { useUserStore } from "../stores/userStore";
import { submitSolve } from "./economyService";
import { reportError } from "./errorReporting";
import { isPermanentRejection } from "../utils/functionErrors";
import { invalidatePuzzleCache } from "./puzzleService";

/**
 * Attempts to re-submit every queued solve.
 *
 * - Processes items sequentially to avoid hammering the Edge Function.
 * - Accepted items are removed from the queue.
 * - Items that still fail remain queued for the next attempt.
 *
 * @returns Number of solves successfully submitted
 */
export async function drainPendingSolves(): Promise<number> {
  const { pendingSolves, dequeuePendingSolve, applyServerBalance } =
    useUserStore.getState();

  if (pendingSolves.length === 0) return 0;

  console.log(`[OfflineSync] Draining ${pendingSolves.length} solve(s)...`);

  let flushed = 0;

  for (const pending of pendingSolves) {
    try {
      const result = await submitSolve(
        pending.puzzleId,
        pending.letters,
        pending.elapsedSeconds,
      );
      applyServerBalance(result.newBalance);
      dequeuePendingSolve(pending.puzzleId);
      flushed++;
      console.log(
        `[OfflineSync] Submitted ${pending.puzzleId}: ` +
          `${result.score} pts, +${result.coinsEarned} coins`,
      );
    } catch (err) {
      console.warn(
        `[OfflineSync] Retry failed for ${pending.puzzleId}:`,
        err instanceof Error ? err.message : err,
      );
      // A solve that keeps failing is unpaid progress the player can see —
      // worth an issue, not just a log.
      reportError("sync", err, { puzzleId: pending.puzzleId });

      // A refusal will be refused again. Dropping it stops the queue
      // retrying something unacceptable on every focus, and clears the
      // "pending sync" state that would otherwise never resolve. Anything
      // that might succeed later stays put.
      if (isPermanentRejection(err)) {
        console.warn(
          `[OfflineSync] Dropping ${pending.puzzleId}: the server rejected ` +
            "the submission itself, so retrying cannot help.",
        );
        dequeuePendingSolve(pending.puzzleId);
      }
    }
  }

  if (flushed > 0) {
    await useUserStore.getState().refreshBalance();

    // The completion rows these just created are invisible until the
    // five-minute read cache is dropped. Without this a solve that reached
    // the server late still looked missing from Recent Activity, and its
    // puzzle still looked unplayed — the sync worked and nothing showed it.
    invalidatePuzzleCache();
  }

  console.log(
    `[OfflineSync] Drained ${flushed}/${pendingSolves.length} solve(s)`,
  );
  return flushed;
}

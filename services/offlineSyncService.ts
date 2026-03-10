/**
 * offlineSyncService.ts — Drains the offline completion queue.
 *
 * When a puzzle completion fails (no network), it's stored in the userStore's
 * `pendingCompletions` queue. This service retries each item when the app
 * comes back to the foreground or gains network access.
 *
 * Call `drainPendingCompletions()` from the root layout's AppState listener.
 */

import { useUserStore } from "../stores/userStore";
import { recordCompletion } from "./puzzleService";

/**
 * Attempts to re-submit all queued completions that previously failed.
 *
 * - Processes items sequentially to avoid hammering Supabase.
 * - Successfully submitted items are removed from the queue.
 * - Items that still fail remain in the queue for the next retry.
 *
 * @returns Number of completions successfully flushed
 */
export async function drainPendingCompletions(): Promise<number> {
  const { pendingCompletions, dequeuePendingCompletion, syncToSupabase } =
    useUserStore.getState();

  if (pendingCompletions.length === 0) return 0;

  console.log(
    `[OfflineSync] Draining ${pendingCompletions.length} pending completion(s)...`,
  );

  let flushed = 0;

  for (const pending of pendingCompletions) {
    try {
      const success = await recordCompletion({
        puzzleId: pending.puzzleId,
        userId: pending.userId,
        score: pending.score,
        timeTaken: pending.timeTaken,
        accuracy: pending.accuracy,
        hintsUsed: pending.hintsUsed,
        coinsEarned: pending.coinsEarned,
        puzzleDate: pending.puzzleDate,
        category: pending.category,
        difficulty: pending.difficulty,
        gridSize: pending.gridSize,
      });

      if (success) {
        dequeuePendingCompletion(pending.puzzleId);
        flushed++;
        console.log(
          `[OfflineSync] Flushed completion for puzzle: ${pending.puzzleId}`,
        );
      }
    } catch (err) {
      console.warn(
        `[OfflineSync] Retry failed for puzzle ${pending.puzzleId}:`,
        err,
      );
      // Leave in queue — will retry next time
    }
  }

  if (flushed > 0) {
    // Sync the profile to ensure remote stats match local after flush
    await syncToSupabase().catch((err) =>
      console.warn("[OfflineSync] Profile sync after drain failed:", err),
    );
  }

  console.log(
    `[OfflineSync] Drained ${flushed}/${pendingCompletions.length} completions`,
  );
  return flushed;
}

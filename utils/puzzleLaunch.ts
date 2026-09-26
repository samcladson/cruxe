export type PuzzleLaunchDecision = "resume" | "conflict" | "start";

/**
 * Decides what happens when the player taps a puzzle to play.
 *
 * "resume" and "start" both go straight through; "conflict" means a
 * different, unfinished puzzle already occupies the single active slot and
 * the player must choose to end it or resume it before a new one can start.
 */
export function decidePuzzleLaunch(
  activePuzzle: { id: string; isComplete: boolean } | null,
  targetId: string,
): PuzzleLaunchDecision {
  if (!activePuzzle || activePuzzle.isComplete) return "start";
  if (activePuzzle.id === targetId) return "resume";
  return "conflict";
}

import { router } from "expo-router";
import { useCallback, useState } from "react";
import { usePuzzleStore } from "../stores/puzzleStore";
import { Puzzle } from "../types/puzzle.types";
import { decidePuzzleLaunch } from "../utils/puzzleLaunch";

/**
 * Gates every "play this puzzle" tap through the active-puzzle check, so
 * resuming the puzzle already in progress never re-fetches a blank grid and
 * starting a different one while another is unfinished always asks first.
 *
 * `startNew` is only ever called once the slot is confirmed free — either it
 * already was, or the player chose to end what was there.
 */
export function usePuzzleLauncher() {
  const [conflictPuzzle, setConflictPuzzle] = useState<Puzzle | null>(null);
  const [pendingStart, setPendingStart] = useState<(() => void) | null>(null);

  const launch = useCallback((targetId: string, startNew: () => void) => {
    const activePuzzle = usePuzzleStore.getState().activePuzzle;
    const decision = decidePuzzleLaunch(activePuzzle, targetId);

    if (decision === "resume") {
      router.push({ pathname: `/game/${targetId}` } as any);
      return;
    }

    if (decision === "conflict") {
      setConflictPuzzle(activePuzzle);
      setPendingStart(() => startNew);
      return;
    }

    startNew();
  }, []);

  const resolveEnd = useCallback(() => {
    usePuzzleStore.getState().clearActivePuzzle();
    setConflictPuzzle(null);
    pendingStart?.();
    setPendingStart(null);
  }, [pendingStart]);

  const resolveResume = useCallback(() => {
    const activePuzzle = usePuzzleStore.getState().activePuzzle;
    setConflictPuzzle(null);
    setPendingStart(null);
    if (activePuzzle) {
      router.push({ pathname: `/game/${activePuzzle.id}` } as any);
    }
  }, []);

  const dismiss = useCallback(() => {
    setConflictPuzzle(null);
    setPendingStart(null);
  }, []);

  return { conflictPuzzle, launch, resolveEnd, resolveResume, dismiss };
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  getWordCells,
  getActiveClue as resolveActiveClue,
} from "../services/hintEngine";
import { CrosswordClue, Direction, Puzzle } from "../types/puzzle.types";

/**
 * puzzleStore.ts — Global state for the active crossword puzzle session.
 *
 * Manages grid state, cell selection, direction toggling, timer,
 * hint actions (reveal letter, reveal word, check errors), and
 * completion checking.
 */

interface PuzzleState {
  activePuzzle: Puzzle | null;
  selectedCell: { row: number; col: number } | null;
  selectedDirection: Direction;
  timer: number;
  isPaused: boolean;
  checksRemaining: number;

  // Setters
  setActivePuzzle: (puzzle: Puzzle) => void;
  selectCell: (row: number, col: number) => void;
  toggleDirection: () => void;
  setCellValue: (row: number, col: number, value: string) => void;
  clearCell: (row: number, col: number) => void;
  clearWord: () => void;
  incrementTimer: () => void;
  setPause: (paused: boolean) => void;

  // Hint actions
  revealLetter: () => boolean;
  revealWord: () => number;
  checkErrors: () => void;
  useHint: () => void; // Legacy — maps to revealLetter

  // Completion & accuracy
  checkCompletion: () => boolean;
  forceCompletePuzzle: () => void;
  checkAnswers: () => void;
  decrementCheck: () => void;
  isGridCompletelyFilled: () => boolean;
  getAccuracy: () => number;

  // Active clue helper
  getActiveClue: () => CrosswordClue | null;

  // Cleanup
  clearActivePuzzle: () => void;
}

export const usePuzzleStore = create<PuzzleState>()(
  persist(
    (set, get) => ({
      activePuzzle: null,
      selectedCell: null,
      selectedDirection: "across",
      timer: 0,
      isPaused: false,
      checksRemaining: 5,

      setActivePuzzle: (puzzle) =>
        set({
          activePuzzle: puzzle,
          timer: 0,
          isPaused: false,
          selectedCell: null,
          checksRemaining: 5,
        }),

      selectCell: (row, col) => {
        const {
          activePuzzle,
          selectedCell,
          selectedDirection,
          toggleDirection,
        } = get();
        if (!activePuzzle) return;

        const cell = activePuzzle.grid[row][col];
        if (cell.isBlocked) return;

        if (selectedCell?.row === row && selectedCell?.col === col) {
          toggleDirection();
        } else {
          // Ensure Direction Lock: Set direction to the first valid one for the tapped cell
          let newDirection = selectedDirection;
          let targetClueId = cell.clueIds.find((id) =>
            id.includes(selectedDirection),
          );

          if (!targetClueId && cell.clueIds.length > 0) {
            targetClueId = cell.clueIds[0];
            const fallbackClue = activePuzzle.clues.find(
              (c) => c.id === targetClueId,
            );
            if (fallbackClue) {
              newDirection = fallbackClue.direction;
            }
          }

          set({ selectedCell: { row, col }, selectedDirection: newDirection });
        }
      },

      toggleDirection: () => {
        const { activePuzzle, selectedCell, selectedDirection } = get();
        if (!activePuzzle || !selectedCell) return;

        const cell = activePuzzle.grid[selectedCell.row][selectedCell.col];
        if (cell.isBlocked || cell.clueIds.length === 0) return;

        // Find available directions for this specific cell
        const cellClues = activePuzzle.clues.filter((c) =>
          cell.clueIds.includes(c.id),
        );
        const availableDirs = cellClues.map((c) => c.direction);

        if (availableDirs.length === 0) return;

        // Determine what the active clue actually is (accounting for fallback logic in the UI)
        let actualCurrentDir = selectedDirection;
        let targetClueId = cell.clueIds.find((id) =>
          id.includes(selectedDirection),
        );

        // If the global direction isn't in this cell, the UI fell back to the first clue.
        if (!targetClueId) {
          targetClueId = cell.clueIds[0];
          const fallbackClue = activePuzzle.clues.find(
            (c) => c.id === targetClueId,
          );
          if (fallbackClue) {
            actualCurrentDir = fallbackClue.direction;
          }
        }

        const currentIdx = availableDirs.indexOf(actualCurrentDir);
        const nextIdx =
          currentIdx === -1 ? 0 : (currentIdx + 1) % availableDirs.length;

        set({ selectedDirection: availableDirs[nextIdx] });
      },

      setCellValue: (row, col, value) => {
        set((state) => {
          if (!state.activePuzzle) return state;
          const newGrid = [...state.activePuzzle.grid];
          newGrid[row][col] = {
            ...newGrid[row][col],
            userInput: value.toUpperCase(),
            state: "filled",
          };
          return { activePuzzle: { ...state.activePuzzle, grid: newGrid } };
        });
      },

      clearCell: (row, col) => {
        set((state) => {
          if (!state.activePuzzle) return state;
          const newGrid = [...state.activePuzzle.grid];
          const cell = newGrid[row][col];
          if (cell.isPreFilled) return state; // Don't clear pre-filled hints

          newGrid[row][col] = {
            ...cell,
            userInput: "",
            state: "empty",
          };
          return { activePuzzle: { ...state.activePuzzle, grid: newGrid } };
        });
      },

      clearWord: () => {
        const { activePuzzle, selectedCell, selectedDirection } = get();
        if (!activePuzzle || !selectedCell) return;

        const clue = resolveActiveClue(
          activePuzzle,
          selectedCell,
          selectedDirection,
        );
        if (!clue) return;

        const cells = getWordCells(activePuzzle.grid, clue);

        set((state) => {
          if (!state.activePuzzle) return state;
          const newGrid = state.activePuzzle.grid.map((r) =>
            r.map((c) => ({ ...c })),
          );

          cells.forEach((cell) => {
            if (cell.isPreFilled) return; // Skip pre-filled hints

            newGrid[cell.row][cell.col] = {
              ...newGrid[cell.row][cell.col],
              userInput: "",
              state: "empty",
            };
          });

          return {
            activePuzzle: { ...state.activePuzzle, grid: newGrid },
          };
        });
      },

      // ─── Hint Actions ───────────────────────────────────────────────

      /**
       * Reveals the correct letter for the currently selected cell.
       * Marks the cell as pre-filled so it can't be deleted.
       * Returns true if a letter was actually revealed (false if already correct or no selection).
       */
      revealLetter: () => {
        const { activePuzzle, selectedCell } = get();
        if (!activePuzzle || !selectedCell) return false;

        const { row, col } = selectedCell;
        const cell = activePuzzle.grid[row][col];

        // Skip if cell is blocked, has no letter, or is already correct
        if (cell.isBlocked || !cell.letter) return false;
        if (cell.userInput === cell.letter) return false;

        set((state) => {
          if (!state.activePuzzle) return state;
          const newGrid = state.activePuzzle.grid.map((r) =>
            r.map((c) => ({ ...c })),
          );
          newGrid[row][col] = {
            ...newGrid[row][col],
            userInput: cell.letter!,
            state: "correct",
            isPreFilled: true,
          };
          return {
            activePuzzle: {
              ...state.activePuzzle,
              grid: newGrid,
              hintsUsed: state.activePuzzle.hintsUsed + 1,
            },
          };
        });
        return true;
      },

      /**
       * Reveals all unrevealed cells in the currently active word.
       * Only fills cells that don't already have the correct answer.
       * Returns the number of letters that were actually revealed (for cost calculation).
       */
      revealWord: () => {
        const { activePuzzle, selectedCell, selectedDirection } = get();
        if (!activePuzzle || !selectedCell) return 0;

        const clue = resolveActiveClue(
          activePuzzle,
          selectedCell,
          selectedDirection,
        );
        if (!clue) return 0;

        const cells = getWordCells(activePuzzle.grid, clue);

        // Count how many cells actually need revealing
        let revealedCount = 0;

        set((state) => {
          if (!state.activePuzzle) return state;
          const newGrid = state.activePuzzle.grid.map((r) =>
            r.map((c) => ({ ...c })),
          );

          cells.forEach((cell) => {
            // Skip cells that already have the correct answer
            if (cell.userInput === cell.letter) return;
            if (!cell.letter) return;

            newGrid[cell.row][cell.col] = {
              ...newGrid[cell.row][cell.col],
              userInput: cell.letter,
              state: "correct",
              isPreFilled: true,
            };
            revealedCount++;
          });

          return {
            activePuzzle: {
              ...state.activePuzzle,
              grid: newGrid,
              hintsUsed: state.activePuzzle.hintsUsed + revealedCount,
            },
          };
        });

        return revealedCount;
      },

      /**
       * Highlights all incorrectly filled cells as "incorrect" state (shown in red).
       * Cells with no input or correct input are left untouched.
       * Uses checksRemaining if available; otherwise the caller should deduct coins.
       */
      checkErrors: () => {
        set((state) => {
          if (!state.activePuzzle) return state;

          const newGrid = state.activePuzzle.grid.map((row) =>
            row.map((cell) => {
              if (cell.isBlocked || !cell.userInput) return cell;

              const newState: "correct" | "incorrect" =
                cell.userInput === cell.letter ? "correct" : "incorrect";

              return {
                ...cell,
                state: newState,
              };
            }),
          );

          return {
            activePuzzle: { ...state.activePuzzle, grid: newGrid },
          };
        });
      },

      /** Legacy hint method — delegates to revealLetter for backward compatibility */
      useHint: () => {
        get().revealLetter();
      },

      // ─── Timer ──────────────────────────────────────────────────────

      incrementTimer: () =>
        set((state) => {
          if (
            state.isPaused ||
            !state.activePuzzle ||
            state.activePuzzle.isComplete
          )
            return state;
          return { timer: state.timer + 1 };
        }),

      setPause: (paused) => set({ isPaused: paused }),

      // ─── Completion & Accuracy ─────────────────────────────────────

      checkCompletion: () => {
        const { activePuzzle } = get();
        if (!activePuzzle) return false;

        let isComplete = true;

        // Check all non-blocked cells
        activePuzzle.grid.forEach((row) => {
          row.forEach((cell) => {
            if (!cell.isBlocked) {
              if (cell.userInput !== cell.letter) {
                isComplete = false;
              }
            }
          });
        });

        if (isComplete) {
          set((state) => ({
            activePuzzle: state.activePuzzle
              ? {
                  ...state.activePuzzle,
                  isComplete: true,
                  completedAt: Date.now(),
                }
              : null,
          }));
        }

        return isComplete;
      },

      forceCompletePuzzle: () => {
        set((state) => ({
          activePuzzle: state.activePuzzle
            ? {
                ...state.activePuzzle,
                isComplete: true,
                completedAt: Date.now(),
              }
            : null,
        }));
      },

      checkAnswers: () => {
        set((state) => {
          if (!state.activePuzzle) return state;

          const newGrid = state.activePuzzle.grid.map((row) =>
            row.map((cell) => {
              if (cell.isBlocked || !cell.userInput) return cell;

              const newState: "correct" | "incorrect" =
                cell.userInput === cell.letter ? "correct" : "incorrect";

              return {
                ...cell,
                state: newState,
              };
            }),
          );

          return {
            activePuzzle: { ...state.activePuzzle, grid: newGrid },
          };
        });
      },

      decrementCheck: () => {
        set((state) => ({
          checksRemaining: Math.max(0, state.checksRemaining - 1),
        }));
      },

      isGridCompletelyFilled: () => {
        const { activePuzzle } = get();
        if (!activePuzzle) return false;

        // Return true if EVERY unblocked cell has a userInput
        return activePuzzle.grid.every((row) =>
          row.every((cell) => cell.isBlocked || !!cell.userInput),
        );
      },

      /**
       * Computes accuracy as the ratio of correctly filled cells to total fillable cells.
       * Returns a value between 0 and 1 (e.g. 0.94 for 94% accuracy).
       */
      getAccuracy: () => {
        const { activePuzzle } = get();
        if (!activePuzzle) return 0;

        let totalCells = 0;
        let correctCells = 0;

        activePuzzle.grid.forEach((row) => {
          row.forEach((cell) => {
            if (!cell.isBlocked) {
              totalCells++;
              if (cell.userInput === cell.letter) {
                correctCells++;
              }
            }
          });
        });

        return totalCells > 0 ? correctCells / totalCells : 0;
      },

      // ─── Active Clue Helper ────────────────────────────────────────

      /**
       * Returns the currently active CrosswordClue based on the selected cell
       * and direction. Used by the hint modal to show word preview and calculate costs.
       */
      getActiveClue: () => {
        const { activePuzzle, selectedCell, selectedDirection } = get();
        if (!activePuzzle || !selectedCell) return null;
        return resolveActiveClue(activePuzzle, selectedCell, selectedDirection);
      },

      /** Clears all puzzle state — used when discarding stale progress */
      clearActivePuzzle: () =>
        set({
          activePuzzle: null,
          selectedCell: null,
          selectedDirection: "across" as Direction,
          timer: 0,
          isPaused: false,
          checksRemaining: 5,
        }),
    }),
    {
      name: "puzzle-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist game-critical state, not transient UI state
      partialize: (state: PuzzleState) => ({
        activePuzzle: state.activePuzzle,
        timer: state.timer,
        checksRemaining: state.checksRemaining,
      }),
    },
  ),
);

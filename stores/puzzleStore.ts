import { create } from "zustand";
import { Direction, Puzzle } from "../types/puzzle.types";

interface PuzzleState {
  activePuzzle: Puzzle | null;
  selectedCell: { row: number; col: number } | null;
  selectedDirection: Direction;
  timer: number;
  isPaused: boolean;
  checksRemaining: number;

  setActivePuzzle: (puzzle: Puzzle) => void;
  selectCell: (row: number, col: number) => void;
  toggleDirection: () => void;
  setCellValue: (row: number, col: number, value: string) => void;
  clearCell: (row: number, col: number) => void;
  useHint: () => void;
  incrementTimer: () => void;
  setPause: (paused: boolean) => void;
  checkCompletion: () => boolean;
  checkAnswers: () => void;
  decrementCheck: () => void;
  isGridCompletelyFilled: () => boolean;
  getAccuracy: () => number;
}

export const usePuzzleStore = create<PuzzleState>((set, get) => ({
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
    const { activePuzzle, selectedCell, selectedDirection, toggleDirection } =
      get();
    if (!activePuzzle) return;

    const cell = activePuzzle.grid[row][col];
    if (cell.isBlocked) return;

    if (selectedCell?.row === row && selectedCell?.col === col) {
      toggleDirection();
    } else {
      set({ selectedCell: { row, col } });
    }
  },

  toggleDirection: () => {
    const DIRS: Direction[] = [
      "across",
      "down",
      "reverse_across",
      "reverse_down",
    ];
    set((state) => {
      const idx = DIRS.indexOf(state.selectedDirection);
      return { selectedDirection: DIRS[(idx + 1) % DIRS.length] };
    });
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

  useHint: () => {
    const { activePuzzle, selectedCell } = get();
    if (!activePuzzle || !selectedCell) return;

    const { row, col } = selectedCell;
    const cell = activePuzzle.grid[row][col];

    if (cell.letter) {
      set((state) => {
        if (!state.activePuzzle) return state;
        const newGrid = [...state.activePuzzle.grid];
        newGrid[row][col] = {
          ...cell,
          userInput: cell.letter!,
          state: "correct",
          isPreFilled: true, // Treat revealed hints as pre-filled so they can't be deleted easily
        };
        return {
          activePuzzle: {
            ...state.activePuzzle,
            grid: newGrid,
            hintsUsed: state.activePuzzle.hintsUsed + 1,
          },
        };
      });
    }
  },

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

  checkCompletion: () => {
    const { activePuzzle } = get();
    if (!activePuzzle) return false;

    let isComplete = true;
    let correctWords = 0;

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
}));

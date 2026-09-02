import React, { useEffect, useRef } from "react";
import { Dimensions, StyleSheet, TextInput, View } from "react-native";
import { SFX } from "../../services/soundService";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { GridCell } from "./GridCell";
import { resolveClueId } from "../../utils/clueId";

const { width } = Dimensions.get("window");

/**
 * CrosswordGrid renders the full NxN crossword grid.
 * Uses a classic crossword layout — cells are tightly packed in a square
 * with thin borders between them. A hidden TextInput captures keyboard events.
 */
export function CrosswordGrid() {
  const {
    activePuzzle,
    selectedCell,
    selectedDirection,
    selectCell,
    setCellValue,
    clearCell,
  } = usePuzzleStore();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (activePuzzle && selectedCell) {
      inputRef.current?.focus();
    }
  }, [selectedCell, activePuzzle]);

  if (!activePuzzle) return null;

  const gridSize = activePuzzle.gridSize;
  const maxGridWidth = width - 24;
  const cellSize = Math.floor(maxGridWidth / gridSize);
  const actualGridWidth = cellSize * gridSize;

  /**
   * Finds all cells belonging to the currently active word.
   */
  const getActiveWordCells = () => {
    if (!selectedCell) return [];

    const { row, col } = selectedCell;
    const currentCell = activePuzzle.grid[row][col];
    if (currentCell.isBlocked || currentCell.clueIds.length === 0) return [];

    const targetClueId = resolveClueId(currentCell.clueIds, selectedDirection);
    if (!targetClueId) return [];

    const activeWordCells: { row: number; col: number }[] = [];
    activePuzzle.grid.forEach((r) =>
      r.forEach((c) => {
        if (c.clueIds.includes(targetClueId!)) {
          activeWordCells.push({ row: c.row, col: c.col });
        }
      }),
    );
    return activeWordCells;
  };

  const activeWordCells = getActiveWordCells();

  /**
   * Handles keyboard input — letters fill cells and advance,
   * Backspace clears or moves backward.
   */
  const handleKeyPress = ({ nativeEvent }: any) => {
    // Get fresh state to avoid closure bugs when typing rapidly
    const state = usePuzzleStore.getState();
    const currentActivePuzzle = state.activePuzzle;
    const currentSelectedCell = state.selectedCell;

    if (
      !currentSelectedCell ||
      !currentActivePuzzle ||
      currentActivePuzzle.isComplete
    )
      return;

    const currentCellObj =
      currentActivePuzzle.grid[currentSelectedCell.row][
        currentSelectedCell.col
      ];

    if (nativeEvent.key === "Backspace") {
      if (currentCellObj.userInput && !currentCellObj.isPreFilled) {
        state.clearCell(currentSelectedCell.row, currentSelectedCell.col);
      } else {
        moveSelection(-1);
      }
    } else if (
      nativeEvent.key.length === 1 &&
      /[a-zA-Z]/.test(nativeEvent.key)
    ) {
      if (!currentCellObj.isPreFilled) {
        state.setCellValue(
          currentSelectedCell.row,
          currentSelectedCell.col,
          nativeEvent.key,
        );
        SFX.letterInput();
      }
      moveSelection(1);
    }
  };

  /**
   * Moves the selection forward or backward within the current word.
   */
  const moveSelection = (step: number) => {
    // Use fresh state to calculate active word cells and movement
    const state = usePuzzleStore.getState();
    const currentActivePuzzle = state.activePuzzle;
    const currentSelectedCell = state.selectedCell;
    const currentDirection = state.selectedDirection;

    if (!currentSelectedCell || !currentActivePuzzle) return;

    const { row, col } = currentSelectedCell;
    const currentCell = currentActivePuzzle.grid[row][col];
    if (currentCell.isBlocked || currentCell.clueIds.length === 0) return;

    const targetClueId = resolveClueId(currentCell.clueIds, currentDirection);
    if (!targetClueId) return;

    const currentActiveWordCells: {
      row: number;
      col: number;
      isPreFilled?: boolean;
    }[] = [];
    currentActivePuzzle.grid.forEach((r) =>
      r.forEach((c) => {
        if (c.clueIds.includes(targetClueId!)) {
          currentActiveWordCells.push({
            row: c.row,
            col: c.col,
            isPreFilled: c.isPreFilled,
          });
        }
      }),
    );

    if (currentActiveWordCells.length === 0) return;

    // Sort logically based on direction, so +1 step always moves to the "next" logical letter
    currentActiveWordCells.sort((a, b) => {
      switch (currentDirection) {
        case "across":
          return a.col - b.col;
        case "reverse_across":
          return b.col - a.col;
        case "down":
          return a.row - b.row;
        case "reverse_down":
          return b.row - a.row;
        default:
          return 0;
      }
    });

    const currentIndex = currentActiveWordCells.findIndex(
      (c) =>
        c.row === currentSelectedCell.row && c.col === currentSelectedCell.col,
    );

    if (currentIndex === -1) return;

    let nextIndex = currentIndex + step;

    // Skip over pre-filled cells
    while (
      nextIndex >= 0 &&
      nextIndex < currentActiveWordCells.length &&
      currentActiveWordCells[nextIndex].isPreFilled &&
      step !== 0
    ) {
      nextIndex += Math.sign(step);
    }

    if (nextIndex >= 0 && nextIndex < currentActiveWordCells.length) {
      const nextCell = currentActiveWordCells[nextIndex];
      // moveCursorTo, NOT selectCell: selectCell re-derives direction from
      // the target square, so crossing an intersection would rotate the axis
      // mid-word. The axis stays locked until the player toggles it.
      state.moveCursorTo(nextCell.row, nextCell.col);
      return;
    }

    // Ran off the end of the word. Rather than stopping dead, hand off to the
    // next clue that still needs letters - that hand-off is what makes the
    // grid feel continuous instead of like a series of separate inputs.
    if (step > 0) {
      advanceToNextClue(targetClueId!);
    }
  };

  /**
   * Selects the first empty square of the next clue that still has one,
   * wrapping around. Sets the axis to that clue's own direction.
   */
  const advanceToNextClue = (fromClueId: string) => {
    const state = usePuzzleStore.getState();
    const puzzle = state.activePuzzle;
    if (!puzzle) return;

    const order = puzzle.clues;
    const startIdx = order.findIndex((c) => c.id === fromClueId);
    if (startIdx === -1) return;

    for (let i = 1; i <= order.length; i++) {
      const clue = order[(startIdx + i) % order.length];

      const cells: { row: number; col: number }[] = [];
      puzzle.grid.forEach((r) =>
        r.forEach((c) => {
          if (c.clueIds.includes(clue.id)) cells.push({ row: c.row, col: c.col });
        }),
      );

      cells.sort((a, b) => {
        switch (clue.direction) {
          case "across":
            return a.col - b.col;
          case "reverse_across":
            return b.col - a.col;
          case "down":
            return a.row - b.row;
          case "reverse_down":
            return b.row - a.row;
          default:
            return 0;
        }
      });

      const firstEmpty = cells.find((p) => {
        const cell = puzzle.grid[p.row][p.col];
        return !cell.isPreFilled && !cell.userInput;
      });

      if (firstEmpty) {
        state.setDirection(clue.direction);
        state.moveCursorTo(firstEmpty.row, firstEmpty.col);
        return;
      }
    }
    // Every clue is full. Leave the cursor where it is; completion handles it.
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        autoCorrect={false}
        autoCapitalize="characters"
        onKeyPress={handleKeyPress}
        value=""
        caretHidden
        showSoftInputOnFocus={true}
      />

      <View
        style={[
          styles.gridWrapper,
          { width: actualGridWidth + 2, height: actualGridWidth + 2 },
        ]}
      >
        {activePuzzle.grid.map((row, rIndex) => (
          <View key={`row-${rIndex}`} style={styles.row}>
            {row.map((cell, cIndex) => {
              const isSelected =
                selectedCell?.row === rIndex && selectedCell?.col === cIndex;
              const isActiveWord = activeWordCells.some(
                (ac) => ac.row === rIndex && ac.col === cIndex,
              );

              return (
                <GridCell
                  key={`cell-${rIndex}-${cIndex}`}
                  cell={cell}
                  isSelected={isSelected}
                  isActiveWord={isActiveWord}
                  cellSize={cellSize}
                  onPress={(r, c) => {
                    selectCell(r, c);
                    SFX.cellTap();
                    // Force the keyboard to appear even if manually dismissed
                    if (inputRef.current) {
                      inputRef.current.blur();
                      setTimeout(() => inputRef.current?.focus(), 10);
                    }
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  gridWrapper: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "#050505",
  },
  row: {
    flexDirection: "row",
  },
  hiddenInput: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
});

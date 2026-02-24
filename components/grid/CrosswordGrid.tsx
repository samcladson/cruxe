import React, { useEffect, useRef } from "react";
import { Dimensions, StyleSheet, TextInput, View } from "react-native";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { GridCell } from "./GridCell";

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

    let targetClueId = currentCell.clueIds.find((id) =>
      id.includes(selectedDirection),
    );
    if (!targetClueId) {
      targetClueId = currentCell.clueIds[0];
    }

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
    if (!selectedCell || activePuzzle.isComplete) return;

    if (nativeEvent.key === "Backspace") {
      const currentCellObj =
        activePuzzle.grid[selectedCell.row][selectedCell.col];

      if (currentCellObj.userInput && !currentCellObj.isPreFilled) {
        clearCell(selectedCell.row, selectedCell.col);
      } else {
        moveSelection(-1);
      }
    } else if (
      nativeEvent.key.length === 1 &&
      /[a-zA-Z]/.test(nativeEvent.key)
    ) {
      setCellValue(selectedCell.row, selectedCell.col, nativeEvent.key);
      moveSelection(1);
    }
  };

  /**
   * Moves the selection forward or backward within the current word.
   */
  const moveSelection = (step: number) => {
    if (!selectedCell || activeWordCells.length === 0) return;

    const currentIndex = activeWordCells.findIndex(
      (c) => c.row === selectedCell.row && c.col === selectedCell.col,
    );

    if (currentIndex === -1) return;

    const nextIndex = currentIndex + step;

    if (nextIndex >= 0 && nextIndex < activeWordCells.length) {
      const nextCell = activeWordCells[nextIndex];
      selectCell(nextCell.row, nextCell.col);
    }
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
                  onPress={selectCell}
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

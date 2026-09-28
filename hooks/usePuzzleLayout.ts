import { useRef, useState } from "react";
import { LayoutChangeEvent, useWindowDimensions, View } from "react-native";
import { gridOuterHeight } from "../utils/gridSize";
import { sheetLayout } from "../utils/sheetLayout";
import { useKeyboardOverlap } from "../utils/useKeyboardTop";

/**
 * The measurements a puzzle screen needs to lay out its grid, clue sheet and
 * keyboard Done bar.
 *
 * With the keyboard closed, the area below the clue bar is shared between the
 * grid and the clue sheet (see sheetLayout.ts): the sheet fills the space
 * below the grid when a clue row fits, and otherwise sits as its controls
 * alone on the bottom edge with the grid centred above it. With the keyboard
 * open nothing moves: the keyboard covers the sheet, the Done bar sits on the
 * keyboard's top edge, and the grid slides its typed row clear of both.
 *
 * Everything keyboard-related is measured from the bottom of the body. The
 * keyboard's own screen position is never compared with measureInWindow
 * positions, which on Android edge-to-edge are offset by the status bar (see
 * keyboardOverlap.ts).
 *
 * The grid's height is calculated, never measured (utils/gridSize.ts):
 * measuring it fed a loop that made the centred grid shudder by a pixel. The
 * other measurements ignore changes under a point for the same reason.
 *
 * Wire it up as: `bodyRef` / `onBodyLayout` on the screen's full-height body
 * (inside the SafeAreaView); `onAreaLayout` on a `flex: 1` view below the
 * clue bar holding the grid; `gridOffset` (as marginTop) on a view wrapping
 * `<CrosswordGrid>`; `sheet` into `<ClueSheet>`; and `keyboardOverlap` into
 * `<KeyboardDoneBar>`.
 */
export function usePuzzleLayout(gridSize: number) {
  const bodyRef = useRef<View>(null);
  /** The body's bottom edge, in the same (window) coordinates the grid uses. */
  const [bodyBottom, setBodyBottom] = useState(0);
  const [areaHeight, setAreaHeight] = useState(0);
  const [chromeHeight, setChromeHeight] = useState(0);
  const keyboardOverlap = useKeyboardOverlap();
  const { width } = useWindowDimensions();
  const gridHeight = gridOuterHeight(width, gridSize);

  /** Ignores changes under a point: pixel rounding, not a real resize. */
  const settle = (set: (fn: (prev: number) => number) => void) => (next: number) =>
    set((prev) => (Math.abs(prev - next) < 1 ? prev : next));

  const sheet = sheetLayout({ areaHeight, gridHeight, chromeHeight });

  return {
    bodyRef,
    onBodyLayout: () => {
      bodyRef.current?.measureInWindow((_x, y, _w, h) => setBodyBottom(y + h));
    },
    onAreaLayout: (e: LayoutChangeEvent) =>
      settle(setAreaHeight)(e.nativeEvent.layout.height),
    /** Space above the grid; centres it when the sheet has no clue list. */
    gridOffset: sheet.gridOffset,
    sheet: {
      restingHeight: sheet.restingHeight,
      showList: sheet.showList,
      onChromeHeightChange: settle(setChromeHeight),
    },
    keyboardOverlap,
    /** The keyboard's top edge in window coordinates; Infinity when hidden. */
    keyboardTopInWindow:
      keyboardOverlap > 0 && bodyBottom > 0
        ? bodyBottom - keyboardOverlap
        : Infinity,
  };
}

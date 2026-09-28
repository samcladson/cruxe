import { useRef, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
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
 * Wire it up as: `bodyRef` / `onBodyLayout` on the screen's full-height body
 * (inside the SafeAreaView); `onAreaLayout` on a `flex: 1` view below the
 * clue bar holding the grid; `onGridLayout` and `gridOffset` (as marginTop)
 * on a view wrapping `<CrosswordGrid>`; `sheet` into `<ClueSheet>`; and
 * `keyboardOverlap` into `<KeyboardDoneBar>`.
 */
export function usePuzzleLayout() {
  const bodyRef = useRef<View>(null);
  /** The body's bottom edge, in the same (window) coordinates the grid uses. */
  const [bodyBottom, setBodyBottom] = useState(0);
  const [areaHeight, setAreaHeight] = useState(0);
  const [gridHeight, setGridHeight] = useState(0);
  const [chromeHeight, setChromeHeight] = useState(0);
  const keyboardOverlap = useKeyboardOverlap();

  const sheet = sheetLayout({ areaHeight, gridHeight, chromeHeight });

  return {
    bodyRef,
    onBodyLayout: () => {
      bodyRef.current?.measureInWindow((_x, y, _w, h) => setBodyBottom(y + h));
    },
    onAreaLayout: (e: LayoutChangeEvent) =>
      setAreaHeight(e.nativeEvent.layout.height),
    onGridLayout: (e: LayoutChangeEvent) =>
      setGridHeight(e.nativeEvent.layout.height),
    /** Space above the grid; centres it when the sheet has no clue list. */
    gridOffset: sheet.gridOffset,
    sheet: {
      restingHeight: sheet.restingHeight,
      showList: sheet.showList,
      onChromeHeightChange: setChromeHeight,
    },
    keyboardOverlap,
    /** The keyboard's top edge in window coordinates; Infinity when hidden. */
    keyboardTopInWindow:
      keyboardOverlap > 0 && bodyBottom > 0
        ? bodyBottom - keyboardOverlap
        : Infinity,
  };
}

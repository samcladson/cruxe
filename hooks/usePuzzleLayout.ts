import { useRef, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { useKeyboardOverlap } from "../utils/useKeyboardTop";

/**
 * The measurements a puzzle screen needs to lay out its grid, clue sheet and
 * keyboard Done bar.
 *
 * The clue sheet fills whatever height the grid leaves and never moves for
 * the keyboard, which simply covers it. The Done bar sits on the keyboard's
 * top edge (`keyboardOverlap` above the body's bottom), and the grid slides
 * its typed row clear of both.
 *
 * Everything is measured from the bottom of the body. The keyboard's own
 * screen position is never compared with measureInWindow positions, which on
 * Android edge-to-edge are offset by the status bar (see keyboardOverlap.ts).
 *
 * Wire it up as: `bodyRef` / `onBodyLayout` on the screen's full-height body
 * (inside the SafeAreaView), `onSpaceLayout` on a `flex: 1` view directly
 * under the grid, and the rest into `<CrosswordGrid>`, `<ClueSheet>` and
 * `<KeyboardDoneBar>`.
 */
export function usePuzzleLayout() {
  const bodyRef = useRef<View>(null);
  /** The body's bottom edge, in the same (window) coordinates the grid uses. */
  const [bodyBottom, setBodyBottom] = useState(0);
  const [spaceBelowGrid, setSpaceBelowGrid] = useState(0);
  const [chromeHeight, setChromeHeight] = useState(0);
  const keyboardOverlap = useKeyboardOverlap();

  return {
    bodyRef,
    onBodyLayout: () => {
      bodyRef.current?.measureInWindow((_x, y, _w, h) => setBodyBottom(y + h));
    },
    onSpaceLayout: (e: LayoutChangeEvent) =>
      setSpaceBelowGrid(e.nativeEvent.layout.height),
    spaceBelowGrid,
    chromeHeight,
    setChromeHeight,
    keyboardOverlap,
    /** The keyboard's top edge in window coordinates; Infinity when hidden. */
    keyboardTopInWindow:
      keyboardOverlap > 0 && bodyBottom > 0
        ? bodyBottom - keyboardOverlap
        : Infinity,
  };
}

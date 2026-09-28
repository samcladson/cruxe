import { useRef, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { keyboardLift } from "../utils/keyboardLift";
import { useKeyboardTop } from "../utils/useKeyboardTop";

/**
 * The measurements a puzzle screen needs to lay out its grid and clue sheet.
 *
 * The clue sheet fills whatever height the grid leaves, and while typing it
 * rides on the keyboard as controls only; the grid slides its typed row clear
 * of both. All of it is measured the same way on iOS and Android, rather than
 * leaving iOS to a KeyboardAvoidingView that the grid's own sliding knew
 * nothing about.
 *
 * Wire it up as: `bodyRef` / `onBodyLayout` on the screen's full-height body,
 * `onSpaceLayout` on a `flex: 1` view directly under the grid, and the rest
 * into `<CrosswordGrid>` and `<ClueSheet>`.
 */
export function usePuzzleLayout() {
  const bodyRef = useRef<View>(null);
  const [screenBottom, setScreenBottom] = useState(0);
  const [spaceBelowGrid, setSpaceBelowGrid] = useState(0);
  const [chromeHeight, setChromeHeight] = useState(0);
  const keyboardTop = useKeyboardTop();

  return {
    bodyRef,
    onBodyLayout: () => {
      bodyRef.current?.measureInWindow((_x, y, _w, h) =>
        setScreenBottom(y + h),
      );
    },
    onSpaceLayout: (e: LayoutChangeEvent) =>
      setSpaceBelowGrid(e.nativeEvent.layout.height),
    spaceBelowGrid,
    chromeHeight,
    setChromeHeight,
    keyboardOverlap: keyboardLift(screenBottom, keyboardTop, 0),
  };
}

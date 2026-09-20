import { useEffect, useState } from "react";
import { Keyboard, KeyboardEvent, Platform } from "react-native";

/**
 * The keyboard's top edge in screen coordinates, or Infinity when hidden.
 *
 * Reported rather than derived from a window resize, because Android 15 with
 * edge-to-edge no longer resizes the window for the IME — `adjustResize` is
 * deprecated there and the app draws behind the keyboard instead. Screen
 * coordinates work the same on both platforms, so callers need no branch.
 *
 * iOS gets the `will` events so layout moves with the keyboard rather than
 * after it; Android only reliably emits the `did` pair.
 */
export function useKeyboardTop(): number {
  const [top, setTop] = useState(Infinity);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      // screenY is the top of the keyboard. Falling back to a computed value
      // keeps this working if a platform ever omits it.
      const screenY = e.endCoordinates?.screenY;
      setTop(typeof screenY === "number" ? screenY : Infinity);
    };
    const onHide = () => setTop(Infinity);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return top;
}

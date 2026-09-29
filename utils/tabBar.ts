import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The tab bar's icon row, above the device's bottom inset. */
export const TAB_BAR_CONTENT_HEIGHT = 56;

/**
 * The tab bar's full height: its icon row plus whatever the device reserves at
 * the bottom (the home indicator on iOS; a gesture strip or the button bar on
 * Android). The bar floats over the screens, so their content pads by this.
 */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8);
}

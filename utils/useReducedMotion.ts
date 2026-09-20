import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the OS asks for reduced motion.
 *
 * Screens use this to drop entrance animations entirely rather than play them
 * faster — a stagger that still moves is still motion. Defaults to false, so a
 * device that cannot answer gets the animation; failing to read the setting is
 * not a reason to render nothing.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (!cancelled) setReduceMotion(on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion;
}

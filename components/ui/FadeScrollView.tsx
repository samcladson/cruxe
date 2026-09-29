import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from "react-native";
import { useTabBarHeight } from "../../utils/tabBar";

/** Height of the fade under the header. Tall enough to read as a fade. */
const TOP_FADE = 56;
/** Scrolling this far brings the top fade to full strength. */
const TOP_FULL_AT = 44;
/** The fade strengthens in this many steps: each one redraws the mask. */
const TOP_STEPS = 6;
/** Fade above the tab bar, on top of the bar's own height. */
const BOTTOM_FADE = 26;

/**
 * A ScrollView whose content dissolves into the page at the top and bottom
 * instead of being cut off by the header above and the tab bar below.
 *
 * The top fade grows with the first few points of scrolling: at rest nothing
 * is dimmed and there is no gap under the header, and as content moves up
 * under it, it melts away. (A permanent fade would either dim the first item
 * or need blank space above it.) The mask is redrawn in a few steps rather
 * than animated, because Android's masking does not follow animations.
 *
 * It is a mask, not an overlay: the content itself fades to transparent, so
 * whatever the screen has behind it (its lit, dotted backdrop) shows through.
 * A coloured strip laid over the content shows as a dark band on that
 * backdrop instead. The tab bar floats over the screen (see the tabs layout),
 * so the bottom fade runs out under its icons and the content pads by its
 * height so the last item can scroll fully clear.
 *
 * Drop-in for ScrollView: every prop passes through, and contentContainerStyle
 * is extended rather than replaced.
 */
export const FadeScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function FadeScrollView({ contentContainerStyle, ...props }, ref) {
    const tabBar = useTabBarHeight();
    const bottomZone = tabBar + BOTTOM_FADE;

    const pad = StyleSheet.flatten(contentContainerStyle) ?? {};
    const paddingTop = Number(pad.paddingTop ?? 0);
    const paddingBottom = Number(pad.paddingBottom ?? 0) + bottomZone;

    const [step, setStep] = useState(0);
    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = Math.max(0, e.nativeEvent.contentOffset.y);
      const next = Math.min(TOP_STEPS, Math.ceil((y / TOP_FULL_AT) * TOP_STEPS));
      if (next !== step) setStep(next);
      props.onScroll?.(e);
    };
    // Alpha at the very top edge: opaque at rest, clear at full strength.
    const edge = 1 - step / TOP_STEPS;

    return (
      <MaskedView
        style={styles.fill}
        maskElement={
          <View style={styles.mask}>
            <LinearGradient
              colors={[
                `rgba(0,0,0,${edge})`,
                `rgba(0,0,0,${edge + (1 - edge) * 0.35})`,
                `rgba(0,0,0,${edge + (1 - edge) * 0.8})`,
                "#000",
              ]}
              locations={[0, 0.4, 0.75, 1]}
              style={{ height: TOP_FADE }}
            />
            <View style={styles.solid} />
            <LinearGradient
              colors={["#000", "rgba(0,0,0,0.35)", "rgba(0,0,0,0)"]}
              locations={[0, 0.3, 0.52]}
              style={{ height: bottomZone }}
            />
          </View>
        }
      >
        <ScrollView
          ref={ref}
          {...props}
          onScroll={handleScroll}
          scrollEventThrottle={props.scrollEventThrottle ?? 16}
          contentContainerStyle={[
            contentContainerStyle,
            { paddingTop, paddingBottom },
          ]}
        />
      </MaskedView>
    );
  },
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  mask: { flex: 1, backgroundColor: "transparent" },
  solid: { flex: 1, backgroundColor: "#000" },
});

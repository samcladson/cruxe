import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef } from "react";
import {
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from "react-native";
import { useTabBarHeight } from "../../utils/tabBar";

/** Height of the fade under the header. Tall enough to read as a fade. */
const TOP_FADE = 56;
/** Fade above the tab bar, on top of the bar's own height. */
const BOTTOM_FADE = 26;

/**
 * A ScrollView whose content dissolves into the page at the top and bottom
 * instead of being cut off by the header above and the tab bar below.
 *
 * The mask never changes, so nothing redraws while scrolling. To keep the
 * first item clear of the top fade at rest, the scroll area starts TOP_FADE
 * above where the content should sit, under the header (which draws above
 * it: see ScreenHeader), and its content pads down by the same amount. At
 * rest the fade lies over the header's own empty space; scrolling moves
 * content up into it and it melts away under the title. A fade that strengthened
 * as you scrolled popped in visibly at the first step.
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
    const paddingTop = Number(pad.paddingTop ?? 0) + TOP_FADE;
    const paddingBottom = Number(pad.paddingBottom ?? 0) + bottomZone;

    return (
      <MaskedView
        style={styles.fill}
        // Draws over the header's lower edge; the header sits above it.
        pointerEvents="box-none"
        maskElement={
          <View style={styles.mask}>
            <LinearGradient
              colors={[
                "rgba(0,0,0,0)",
                "rgba(0,0,0,0.35)",
                "rgba(0,0,0,0.8)",
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
  // Starts TOP_FADE above its slot, under the header.
  fill: { flex: 1, marginTop: -TOP_FADE },
  mask: { flex: 1, backgroundColor: "transparent" },
  solid: { flex: 1, backgroundColor: "#000" },
});

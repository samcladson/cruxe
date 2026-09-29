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

/** Height of the fade under the header. */
const TOP_FADE = 22;
/** Fade above the tab bar, on top of the bar's own height. */
const BOTTOM_FADE = 26;
/** Blank space above the first item at rest, so it clears the top fade. */
const TOP_REST = 10;

/**
 * A ScrollView whose content dissolves into the page at the top and bottom
 * instead of being cut off by the header above and the tab bar below.
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
    const paddingTop = Number(pad.paddingTop ?? 0) + TOP_REST;
    const paddingBottom = Number(pad.paddingBottom ?? 0) + bottomZone;

    return (
      <MaskedView
        style={styles.fill}
        maskElement={
          <View style={styles.mask}>
            <LinearGradient
              colors={["rgba(0,0,0,0)", "#000"]}
              style={{ height: TOP_FADE }}
            />
            <View style={styles.solid} />
            <LinearGradient
              colors={["#000", "rgba(0,0,0,0)"]}
              locations={[0, 0.6]}
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
  fill: { flex: 1 },
  mask: { flex: 1, backgroundColor: "transparent" },
  solid: { flex: 1, backgroundColor: "#000" },
});

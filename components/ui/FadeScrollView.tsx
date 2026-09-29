import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../constants/theme";

/** How far each fade reaches into the content. */
const FADE_HEIGHT = 36;
/** A scroll position this close to an end counts as being at it. */
const EDGE_SLACK = 2;

const BG = theme.colors.bgPrimary;
const CLEAR = "rgba(10,10,10,0)";
const SOFT = "rgba(10,10,10,0.75)";

/**
 * A ScrollView whose top and bottom edges dissolve into the page instead of
 * ending at a hard line under the header and above the tab bar.
 *
 * The fades only appear where there is more content in that direction: the
 * top one once you have scrolled down, the bottom one until you reach the end.
 * So at rest the first item is never dimmed, and the last one is never faded
 * away when you have scrolled to it. Drop-in for ScrollView; every prop passes
 * through.
 */
export const FadeScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function FadeScrollView({ onScroll, onLayout, onContentSizeChange, ...props }, ref) {
    const [viewHeight, setViewHeight] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const top = useSharedValue(0);
    const bottom = useSharedValue(0);

    const update = (y: number, view: number, content: number) => {
      const scrollable = content > view + EDGE_SLACK;
      top.value = withTiming(scrollable && y > EDGE_SLACK ? 1 : 0, { duration: 140 });
      bottom.value = withTiming(
        scrollable && y < content - view - EDGE_SLACK ? 1 : 0,
        { duration: 140 },
      );
    };

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      update(contentOffset.y, layoutMeasurement.height, contentSize.height);
      onScroll?.(e);
    };

    const handleLayout = (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setViewHeight(h);
      update(0, h, contentHeight);
      onLayout?.(e);
    };

    const handleContentSize = (w: number, h: number) => {
      setContentHeight(h);
      update(0, viewHeight, h);
      onContentSizeChange?.(w, h);
    };

    const topStyle = useAnimatedStyle(() => ({ opacity: top.value }));
    const bottomStyle = useAnimatedStyle(() => ({ opacity: bottom.value }));

    return (
      <View style={styles.fill}>
        <ScrollView
          ref={ref}
          {...props}
          onScroll={handleScroll}
          onLayout={handleLayout}
          onContentSizeChange={handleContentSize}
          scrollEventThrottle={props.scrollEventThrottle ?? 16}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.fade, styles.fadeTop, topStyle]}
        >
          <LinearGradient
            colors={[BG, SOFT, CLEAR]}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.fade, styles.fadeBottom, bottomStyle]}
        >
          <LinearGradient
            colors={[CLEAR, SOFT, BG]}
            locations={[0, 0.65, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fade: { position: "absolute", left: 0, right: 0, height: FADE_HEIGHT },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
});

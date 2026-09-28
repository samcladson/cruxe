import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../constants/theme";

/**
 * The CRUXE wordmark: five crossword cells, the C in gold.
 *
 * Proportions are the brand asset's (assets/brand/svg/wordmark.svg, drawn by
 * scripts/brand/generate-brand.cjs): a 92-unit cell with a 12-unit gap and
 * corner radius, a 2-unit stroke, and letters at 44 units in bold Manrope.
 * Everything here scales from `cellSize`, so the ratios hold at any size.
 *
 * `animated` adds a quiet, endless motion: a gold cursor moves along R, U, X,
 * E like a letter being typed into each square in turn, warming the cell's
 * edge and letter and lifting it a hair, then rests before going again. The C
 * stays gold throughout. Still for anyone with reduced motion on.
 */

const BRAND_CELL = 92;
const BRAND_GAP = 12;
const BRAND_RADIUS = 12;
const BRAND_STROKE = 2;
const BRAND_FONT = 44;

const LETTERS = ["C", "R", "U", "X", "E"] as const;

/** One pass of the cursor across the four cells, then a rest. */
const CYCLE_MS = 3600;
/** Where in the cycle each of R, U, X, E is lit, and for how long. */
const FIRST_AT = 0.08;
const STEP = 0.13;
const HALF_WIDTH = 0.09;

const INK = theme.colors.textPrimary;
const GOLD = theme.colors.accentGold;
const EDGE = "rgba(255,255,255,0.12)";
const EDGE_LIT = "rgba(238,205,43,0.75)";

interface WordmarkProps {
  /** Width of one letter cell, in points. */
  cellSize: number;
  animated?: boolean;
}

export function Wordmark({ cellSize, animated = false }: WordmarkProps) {
  const reduceMotion = useReducedMotion();
  const cursor = useSharedValue(0);
  const moving = animated && !reduceMotion;

  useEffect(() => {
    if (!moving) return;
    cursor.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(cursor);
  }, [moving]);

  const k = cellSize / BRAND_CELL;
  const cell = {
    width: cellSize,
    height: cellSize,
    borderRadius: BRAND_RADIUS * k,
    borderWidth: Math.max(1, BRAND_STROKE * k),
  };
  const fontSize = BRAND_FONT * k;

  return (
    <View
      style={[styles.row, { gap: BRAND_GAP * k }]}
      accessibilityRole="header"
      accessibilityLabel="Cruxe"
    >
      {LETTERS.map((letter, i) => (
        <Cell
          key={letter}
          letter={letter}
          accent={i === 0}
          // The cursor visits R, U, X, E: indices 1 to 4.
          litAt={FIRST_AT + (i - 1) * STEP}
          cursor={cursor}
          moving={moving && i > 0}
          cellStyle={cell}
          fontSize={fontSize}
          lift={Math.max(1, cellSize * 0.06)}
        />
      ))}
    </View>
  );
}

function Cell({
  letter,
  accent,
  litAt,
  cursor,
  moving,
  cellStyle,
  fontSize,
  lift,
}: {
  letter: string;
  accent: boolean;
  litAt: number;
  cursor: SharedValue<number>;
  moving: boolean;
  cellStyle: object;
  fontSize: number;
  lift: number;
}) {
  // 0 away from the cursor, rising to 1 as it passes this cell.
  const glow = (t: number) => {
    "worklet";
    if (!moving) return 0;
    return interpolate(
      t,
      [litAt - HALF_WIDTH, litAt, litAt + HALF_WIDTH],
      [0, 1, 0],
      "clamp",
    );
  };

  const boxStyle = useAnimatedStyle(() => {
    const g = glow(cursor.value);
    return {
      borderColor: accent ? GOLD : interpolateColor(g, [0, 1], [EDGE, EDGE_LIT]),
      transform: [{ translateY: -lift * g }],
    };
  });
  const textStyle = useAnimatedStyle(() => ({
    color: accent ? GOLD : interpolateColor(glow(cursor.value), [0, 1], [INK, GOLD]),
  }));

  return (
    <Animated.View
      style={[styles.cell, cellStyle, accent && styles.cellAccent, boxStyle]}
    >
      <Animated.Text style={[styles.letter, { fontSize }, textStyle]}>
        {letter}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bgSecondary,
    borderColor: EDGE,
  },
  cellAccent: {
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    borderColor: GOLD,
  },
  letter: {
    fontFamily: "Manrope_700Bold",
    color: INK,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});

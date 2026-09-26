import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { theme } from "../../constants/theme";

const LOGO = require("../../assets/brand/png/icon-outline.png");

export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 700;

export interface ShareCardData {
  puzzleTitle: string;
  categoryLabel: string;
  difficultyLabel: string;
  gridSize: number;
  time: string;
  accuracy: number;
  points: number;
  coins: number;
}

interface StatBoxProps {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  iconColor?: string;
  value: string;
  label: string;
}

function StatBox({ icon, iconColor, value, label }: StatBoxProps) {
  return (
    <View style={styles.statBox}>
      <MaterialIcons
        name={icon}
        size={22}
        color={iconColor ?? theme.colors.accentGold}
      />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * The image captured for social sharing — a fixed-size branded card, not a
 * screenshot of the actual solved-screen UI (which carries buttons and a
 * close icon that don't belong in a shared image).
 *
 * Rendered off-screen but still laid out (never `display: none`), so
 * `react-native-view-shot` has real pixels to capture.
 */
export const ShareCard = forwardRef<View, { data: ShareCardData }>(
  function ShareCard({ data }, ref) {
    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <LinearGradient
          colors={["rgba(238, 205, 43, 0.16)", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.45 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Logo lockup */}
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logo} />
          <Text style={styles.brandText}>CRUXE</Text>
        </View>

        {/* Eyebrow */}
        <View style={styles.eyebrow}>
          <MaterialIcons
            name="emoji-events"
            size={16}
            color={theme.colors.accentGold}
          />
          <Text style={styles.eyebrowText}>PUZZLE SOLVED</Text>
        </View>

        {/* What was actually solved — the whole reason to share */}
        <Text style={styles.puzzleTitle} numberOfLines={2}>
          {data.puzzleTitle}
        </Text>
        <Text style={styles.meta}>
          {data.categoryLabel} • {data.difficultyLabel} • {data.gridSize}×
          {data.gridSize}
        </Text>

        <View style={styles.statsCardGrid}>
          <View style={styles.statsCardRow}>
            <StatBox icon="timer" value={data.time} label="TIME" />
            <View style={styles.statDividerGrid} />
            <StatBox
              icon="check-circle"
              iconColor={theme.colors.accentGreen}
              value={`${data.accuracy}%`}
              label="ACCURACY"
            />
          </View>
          <View style={styles.statHorizontalDivider} />
          <View style={styles.statsCardRow}>
            <StatBox icon="star" value={String(data.points)} label="POINTS" />
            <View style={styles.statDividerGrid} />
            <StatBox
              icon="monetization-on"
              value={`+${data.coins}`}
              label="COINS"
            />
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.tagline}>A new puzzle every day.</Text>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: theme.colors.bgPrimary,
    alignItems: "center",
    paddingTop: 64,
    paddingBottom: 48,
    paddingHorizontal: 32,
    overflow: "hidden",
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 56,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 9,
  },
  brandText: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
    letterSpacing: 3,
  },

  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  eyebrowText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.accentGold,
    letterSpacing: 1.5,
  },

  puzzleTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 26,
    lineHeight: 32,
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  meta: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.8,
    marginBottom: 44,
  },

  statsCardGrid: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  statsCardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  statDividerGrid: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statHorizontalDivider: {
    height: 1,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statValue: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 22,
    color: "#fff",
  },
  statLabel: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "bold",
    letterSpacing: 1,
  },

  footer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
  },
  footerDivider: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(238, 205, 43, 0.3)",
    marginBottom: 16,
  },
  tagline: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.3,
  },
});

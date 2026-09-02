import { router } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { theme } from "../../constants/theme";
import { track } from "../../services/analyticsService";
import { useSettingsStore } from "../../stores/settingsStore";

/**
 * WelcomeScreen — one brand beat before the player touches a grid.
 *
 * Replaces a three-slide carousel of marketing copy. Three screens of prose
 * before any interaction is the classic onboarding leak, and the funnel
 * events here (onboarding_started -> first_solve) measure exactly that drop.
 *
 * One screen rather than none: opening straight onto a puzzle with no framing
 * reads as cheap rather than confident, which is the opposite of how this app
 * presents itself everywhere else.
 */

/** The wordmark, set as crossword cells. The product explaining itself. */
const WORDMARK = ["C", "R", "U", "X", "E"];

export default function WelcomeScreen() {
  useEffect(() => {
    track("onboarding_started");
  }, []);

  const start = () => {
    router.replace("/(auth)/tutorial");
  };

  /** Skipping still completes the first run — we never re-prompt. */
  const skip = () => {
    track("tutorial_skipped", { from: "welcome" });
    useSettingsStore.getState().setHasCompletedOnboarding(true);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Animated.View
            entering={FadeIn.duration(700)}
            style={styles.wordmarkRow}
            accessibilityRole="header"
            accessibilityLabel="Cruxe"
          >
            {WORDMARK.map((letter, i) => (
              <Animated.View
                key={letter}
                entering={FadeInDown.delay(i * 90).duration(500)}
                style={[styles.cell, i === 0 && styles.cellAccent]}
              >
                <Text style={[styles.cellText, i === 0 && styles.cellTextAccent]}>
                  {letter}
                </Text>
              </Animated.View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(600).duration(600)}>
            <Text style={styles.title}>The Elite{"\n"}Crossword</Text>
            <Text style={styles.subtitle}>
              A new set every day. Made properly, and not especially forgiving.
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeInDown.delay(900).duration(500)}
          style={styles.footer}
        >
          <Button title="Show me" onPress={start} />
          <TouchableOpacity
            onPress={skip}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip the walkthrough and go straight to the app"
          >
            <Text style={styles.skipText}>I&apos;ve done this before</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const CELL = 46;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  content: { flex: 1, justifyContent: "space-between", padding: 32 },
  hero: { flex: 1, justifyContent: "center" },

  wordmarkRow: { flexDirection: "row", gap: 6, marginBottom: 40 },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: theme.colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  cellAccent: {
    borderColor: theme.colors.accentGold,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
  },
  cellText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 22,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
  cellTextAccent: { color: theme.colors.accentGold },

  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 42,
    lineHeight: 48,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    lineHeight: 25,
    color: theme.colors.textSecondary,
    marginTop: 18,
    maxWidth: 320,
  },

  footer: { gap: 4 },
  skipButton: { alignItems: "center", paddingVertical: 16 },
  skipText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});

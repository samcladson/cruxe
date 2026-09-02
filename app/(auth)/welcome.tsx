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
 * WelcomeScreen — one brand beat, then straight into solving.
 *
 * This replaces a three-slide carousel of marketing copy. Three screens of
 * prose before the player touches a grid is the classic onboarding leak, and
 * the funnel events here (onboarding_started -> first_solve) exist to measure
 * exactly that drop.
 *
 * One screen is kept rather than none: the app is positioned as a premium
 * product, and opening straight onto a puzzle with no framing reads as cheap
 * rather than confident.
 */
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
        <Animated.View entering={FadeIn.duration(600)} style={styles.hero}>
          <Text style={styles.wordmark}>CRUXE</Text>
          <View style={styles.rule} />
          <Text style={styles.title}>The Elite{"\n"}Crossword</Text>
          <Text style={styles.subtitle}>
            A new set of puzzles every day, from History to Technology.
            Beautifully made, properly difficult.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.footer}
        >
          <Button title="Start solving" onPress={start} />
          <TouchableOpacity
            onPress={skip}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip the tutorial and go to the app"
          >
            <Text style={styles.skipText}>I've done this before — skip</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  content: { flex: 1, justifyContent: "space-between", padding: 32 },
  hero: { flex: 1, justifyContent: "center" },
  wordmark: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 13,
    letterSpacing: 6,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  rule: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 44,
    lineHeight: 50,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    lineHeight: 25,
    color: theme.colors.textSecondary,
    marginTop: 20,
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

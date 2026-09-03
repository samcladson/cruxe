import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { track } from "../../services/analyticsService";
import {
  linkAppleAccount,
  linkGoogleAccount,
} from "../../services/authService";
import { useSettingsStore } from "../../stores/settingsStore";
import { routeAfterStart } from "../../utils/onboardingRoute";

/**
 * WelcomeScreen — the app's single starting screen.
 *
 * This replaces three screens that each framed the app differently: a brand
 * beat, a separate "A warm-up" intro, and a sign-in screen with its own type
 * scale and button styles. A player met two or three framings before touching
 * a grid, and the sign-in offer arrived only after the tutorial was solved —
 * by which point the account it would have saved was already a guest one.
 *
 * It serves two arrivals. A first-time player goes on to the warm-up; someone
 * who has just signed out goes straight back to the tabs, because signing out
 * is not the same as starting over and replaying the tutorial would read as a
 * punishment for it. `routeAfterStart` owns that decision.
 *
 * Signing in is offered, never required — a guest account is a real account
 * here, and the anonymous session already exists by the time this renders.
 */

/** The wordmark, set as crossword cells. The product explaining itself. */
const WORDMARK = ["C", "R", "U", "X", "E"];

type Provider = "google" | "apple";

export default function WelcomeScreen() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding,
  );
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const isBusy = busyProvider !== null;

  useEffect(() => {
    track("onboarding_started");
  }, []);

  /**
   * Leaves the start screen. `replace`, not `push`: there is nothing here
   * worth coming back to, and a back gesture should not land on a sign-in
   * screen for a session that already exists.
   */
  const proceed = () => {
    router.replace(routeAfterStart(hasCompletedOnboarding));
  };

  const continueAsGuest = () => {
    track("tutorial_skipped", { from: "welcome" });
    proceed();
  };

  /**
   * A failed or cancelled sign-in still continues into the app. The player
   * asked to start, not to authenticate, and an anonymous session is already
   * carrying their progress — blocking them on a provider error would be
   * refusing to run the app because an optional convenience failed.
   */
  const signIn = async (provider: Provider) => {
    setBusyProvider(provider);
    try {
      const { error } =
        provider === "google"
          ? await linkGoogleAccount()
          : await linkAppleAccount();
      if (error) {
        Alert.alert(
          "Couldn't sign in",
          `${error.message}\n\nYou can carry on as a guest and link an account later from your profile.`,
        );
      }
    } catch (e: any) {
      Alert.alert("Couldn't sign in", e?.message ?? "Something went wrong.");
    } finally {
      // In a finally so a throw cannot strand the screen on a spinner.
      setBusyProvider(null);
    }
    proceed();
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
                <Text
                  style={[styles.cellText, i === 0 && styles.cellTextAccent]}
                >
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
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.authButton, styles.appleButton]}
              onPress={() => signIn("apple")}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
            >
              {busyProvider === "apple" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={[styles.authButtonText, { color: "#fff" }]}>
                    Continue with Apple
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.authButton, styles.googleButton]}
            onPress={() => signIn("google")}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            {busyProvider === "google" ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#000" />
                <Text style={[styles.authButtonText, { color: "#000" }]}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={continueAsGuest}
            disabled={isBusy}
            style={styles.guestButton}
            accessibilityRole="button"
            accessibilityLabel="Continue as a guest without an account"
          >
            <Text style={styles.guestText}>Continue as guest</Text>
          </TouchableOpacity>

          <Text style={styles.footnote}>
            Signing in keeps your streak and coins across devices. You can link
            an account later from your profile.
          </Text>
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

  footer: { gap: 12 },
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: theme.borderRadius.button,
  },
  googleButton: { backgroundColor: "#ffffff" },
  appleButton: {
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  authButtonText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 16,
    fontWeight: "bold",
  },
  guestButton: { alignItems: "center", paddingVertical: 12 },
  guestText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  footnote: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textMuted,
    textAlign: "center",
    maxWidth: 320,
    alignSelf: "center",
  },
});

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { track } from "../../services/analyticsService";
import {
  sendEmailCode,
  signInWithApple,
  signInWithGoogle,
  verifyEmailCode,
} from "../../services/authService";
import { useSettingsStore } from "../../stores/settingsStore";
import { routeAfterStart } from "../../utils/onboardingRoute";

/**
 * WelcomeScreen — the app's single starting screen.
 *
 * This replaces three screens that each framed the app differently: a brand
 * beat, a separate "A warm-up" intro, and a sign-in screen with its own type
 * scale and button styles. A player met two or three framings before touching
 * a grid, and the sign-in offer arrived only after the tutorial was solved.
 *
 * It serves two arrivals. A first-time player goes on to the warm-up; someone
 * who has just signed out goes straight back to the tabs, because signing out
 * is not the same as starting over and replaying the tutorial would read as a
 * punishment for it. `routeAfterStart` owns that decision.
 *
 * Signing in is required: the app no longer creates an account on launch.
 * Apple is iOS-only and Google can be misconfigured, so an emailed code is
 * offered as a third door rather than leaving a single point of failure.
 */

/** The wordmark, set as crossword cells. The product explaining itself. */
const WORDMARK = ["C", "R", "U", "X", "E"];

type Provider = "google" | "apple" | "email";

/** Which part of the sign-in flow is on screen. */
type Mode = "providers" | "email" | "code";

export default function WelcomeScreen() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding,
  );
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [mode, setMode] = useState<Mode>("providers");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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


  /**
   * A failed sign-in now stays on this screen. It used to continue into the
   * app regardless, because an anonymous session was already carrying the
   * player's progress. There is no such session any more, so proceeding
   * would land them in an app with no account.
   */
  const signIn = async (provider: "google" | "apple") => {
    setBusyProvider(provider);
    try {
      const { error } =
        provider === "google"
          ? await signInWithGoogle()
          : await signInWithApple();
      if (error) {
        Alert.alert(
          "Couldn't sign in",
          error.message +
            "\n\nYou can try again, or sign in with an emailed code instead.",
        );
        return;
      }
      proceed();
    } catch (e: any) {
      Alert.alert("Couldn't sign in", e?.message ?? "Something went wrong.");
    } finally {
      // In a finally so a throw cannot strand the screen on a spinner.
      setBusyProvider(null);
    }
  };

  const requestCode = async () => {
    setBusyProvider("email");
    try {
      const { error } = await sendEmailCode(email);
      if (error) {
        Alert.alert("Couldn't send the code", error.message);
        return;
      }
      setMode("code");
    } finally {
      setBusyProvider(null);
    }
  };

  const submitCode = async () => {
    setBusyProvider("email");
    try {
      const { error } = await verifyEmailCode(email, code);
      if (error) {
        Alert.alert("That code didn't work", error.message);
        return;
      }
      proceed();
    } finally {
      setBusyProvider(null);
    }
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
          {mode === "providers" ? (
            <>
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
              onPress={() => setMode("email")}
              disabled={isBusy}
              style={styles.altButton}
              accessibilityRole="button"
              accessibilityLabel="Sign in with an emailed code instead"
            >
              <Text style={styles.altText}>Use an email code instead</Text>
            </TouchableOpacity>
            </>
          ) : mode === "email" ? (
            <>
              <Text style={styles.emailPrompt}>
                We&apos;ll send a six-digit code to sign you in.
              </Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!isBusy}
                accessibilityLabel="Email address"
              />
              <TouchableOpacity
                style={[styles.authButton, styles.googleButton]}
                onPress={requestCode}
                disabled={isBusy || email.trim() === ""}
                accessibilityRole="button"
                accessibilityLabel="Send me a code"
              >
                {busyProvider === "email" ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={[styles.authButtonText, { color: "#000" }]}>
                    Send me a code
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode("providers")}
                disabled={isBusy}
                style={styles.altButton}
                accessibilityRole="button"
                accessibilityLabel="Back to the other sign-in options"
              >
                <Text style={styles.altText}>Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.emailPrompt}>
                Enter the code we sent to {email}.
              </Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={8}
                editable={!isBusy}
                accessibilityLabel="Six-digit code"
              />
              <TouchableOpacity
                style={[styles.authButton, styles.googleButton]}
                onPress={submitCode}
                disabled={isBusy || code.trim() === ""}
                accessibilityRole="button"
                accessibilityLabel="Sign in with this code"
              >
                {busyProvider === "email" ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={[styles.authButtonText, { color: "#000" }]}>
                    Sign in
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode("email")}
                disabled={isBusy}
                style={styles.altButton}
                accessibilityRole="button"
                accessibilityLabel="Use a different email address"
              >
                <Text style={styles.altText}>Use a different email</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.footnote}>
            Your streak, coins and history live on your account, so they follow
            you to any device you sign in on.
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
  altButton: { alignItems: "center", paddingVertical: 12 },
  emailPrompt: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: 14,
  },
  input: {
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  codeInput: {
    textAlign: "center",
    letterSpacing: 6,
    fontFamily: theme.typography.cellLetter.fontFamily,
  },
  altText: {
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

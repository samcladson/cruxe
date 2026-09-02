import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { theme } from "../../constants/theme";
import {
  getLinkedProviders,
  linkAppleAccount,
  linkGoogleAccount,
} from "../../services/authService";

export default function SignInScreen() {
  const [isLinking, setIsLinking] = useState(false);
  const [linked, setLinked] = useState({ hasGoogle: false, hasApple: false });

  useEffect(() => {
    void getLinkedProviders().then(setLinked);
  }, []);

  const handleGuestSignIn = () => {
    router.replace("/(tabs)");
  };

  const handleGoogleSignIn = async () => {
    if (linked.hasGoogle) {
      router.replace("/(tabs)");
      return;
    }
    setIsLinking(true);
    const { error } = await linkGoogleAccount();
    setIsLinking(false);
    const l = await getLinkedProviders();
    setLinked(l);
    if (error) {
      console.warn("[SignIn] Google Sign-In Issue:", error.message);
    }
    router.replace("/(tabs)");
  };

  const handleAppleSignIn = async () => {
    if (linked.hasApple) {
      router.replace("/(tabs)");
      return;
    }
    setIsLinking(true);
    const { error } = await linkAppleAccount();
    setIsLinking(false);
    const l = await getLinkedProviders();
    setLinked(l);
    if (error) {
      console.warn("[SignIn] Apple Sign-In Issue:", error.message);
    }
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cruxe</Text>
        <Text style={styles.subtitle}>
          Sign in to save your progress, build your streak, and compete
          globally.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {isLinking ? (
          <ActivityIndicator size="large" color={theme.colors.accentGold} style={{ marginVertical: 20 }} />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.authButton, { backgroundColor: "#FFFFFF" }]}
              onPress={handleGoogleSignIn}
              disabled={isLinking}
            >
              <Ionicons name="logo-google" size={24} color="#000" />
              <Text style={[styles.authButtonText, { color: "#000" }]}>
                {linked.hasGoogle
                  ? "Google connected — continue"
                  : "Continue with Google"}
              </Text>
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[
                  styles.authButton,
                  { backgroundColor: "#000000", borderWidth: 1, borderColor: "#333" },
                ]}
                onPress={handleAppleSignIn}
                disabled={isLinking}
              >
                <Ionicons name="logo-apple" size={24} color="#FFF" />
                <Text style={[styles.authButtonText, { color: "#FFF" }]}>
                  {linked.hasApple
                    ? "Apple connected — continue"
                    : "Continue with Apple"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.guestButton}
              onPress={handleGuestSignIn}
              accessibilityRole="button"
              accessibilityLabel="Continue as a guest without an account"
            >
              <Text style={styles.guestText}>Continue as Guest</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    justifyContent: "center",
    padding: 32,
  },
  header: {
    marginBottom: 60,
    alignItems: "center",
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 64,
    color: theme.colors.accentGold,
    marginBottom: 16,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 16,
  },
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: theme.borderRadius.button,
    gap: 12,
  },
  authButtonText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 16,
    fontWeight: "bold",
  },
  guestButton: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 16,
  },
  guestText: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
});

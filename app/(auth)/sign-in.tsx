import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../constants/theme";
import { useUserStore } from "../../stores/userStore";

export default function SignInScreen() {
  const profile = useUserStore((state) => state.profile);

  const handleSignIn = () => {
    // In a real app we'd initiate OAuth using Supabase
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
        <TouchableOpacity
          style={[styles.authButton, { backgroundColor: "#FFFFFF" }]}
          onPress={handleSignIn}
        >
          <Ionicons name="logo-google" size={24} color="#000" />
          <Text style={[styles.authButtonText, { color: "#000" }]}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.authButton,
            { backgroundColor: "#000000", borderWidth: 1, borderColor: "#333" },
          ]}
          onPress={handleSignIn}
        >
          <Ionicons name="logo-apple" size={24} color="#FFF" />
          <Text style={[styles.authButtonText, { color: "#FFF" }]}>
            Continue with Apple
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.guestButton} onPress={handleSignIn}>
          <Text style={styles.guestText}>Continue as Guest</Text>
        </TouchableOpacity>
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

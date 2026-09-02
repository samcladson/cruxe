import { MaterialIcons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";

export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last Updated: March 2026</Text>
        
        <Text style={styles.paragraph}>
          By downloading or using the Cruxe app, these terms will automatically apply to you. You should make sure therefore that you read them carefully before using the app.
        </Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          You are not allowed to copy or modify the app, any part of the app, or our trademarks in any way. You are not allowed to attempt to extract the source code of the app or generate derivative versions. The app itself, and all the trademarks, copyright, database rights, and other intellectual property rights related to it, belong to the creators of Cruxe.
        </Text>

        <Text style={styles.sectionTitle}>2. Virtual Currency (Coins)</Text>
        <Text style={styles.paragraph}>
          Cruxe features an in-app virtual currency ("Coins").
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Coins have absolutely no “real-world” value and cannot be exchanged for cash, real money, or any legal tender.</Text>
          <Text style={styles.bullet}>• You do not "own" the virtual coins; instead, you are purchasing a limited, personal, revocable, non-transferable license to use them solely within the app.</Text>
          <Text style={styles.bullet}>• All sales of virtual items and currency are final, and we do not offer refunds, except in our sole and absolute discretion.</Text>
        </View>

        <Text style={styles.sectionTitle}>3. Account Liability</Text>
        <Text style={styles.paragraph}>
          We recommend linking your account via Apple or Google. If you choose to remain an "Anonymous" user, modifying your device, reinstalling the app, or clearing app storage may result in an irrecoverable loss of all purchased coins, progression, and streaks. We cannot be held liable for lost virtual currency in anonymous profiles.
        </Text>

        <Text style={styles.sectionTitle}>4. User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to exploit bugs, use automation software (bots), or hack the application to artificially inflate leaderboard scores or generate unauthorized coins. Accounts found violating these rules may be permanently banned without notice.
        </Text>

        <Text style={styles.sectionTitle}>5. Modifications to the Service</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify or stop offering the app, or any part of the app, at any time without notice.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
  },
  content: {
    padding: 24,
  },
  lastUpdated: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 24,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.accentGold,
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletList: {
    marginBottom: 16,
    paddingLeft: 8,
    gap: 12,
  },
  bullet: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
});

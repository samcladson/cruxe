import { MaterialIcons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";

export default function PrivacyPolicyScreen() {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last Updated: September 2026</Text>
        
        <Text style={styles.paragraph}>
          Welcome to Cruxe. Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you use our mobile application.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We collect minimal information necessary to provide you with the Cruxe crossword experience. This includes:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• <Text style={styles.bold}>Account Data:</Text> If you choose to link a Google or Apple account, we securely store your provided name and an authentication token via Supabase to sync your progress.</Text>
          <Text style={styles.bullet}>• <Text style={styles.bold}>Gameplay Data:</Text> We store your puzzle completion times, scores, current streak, and coin balance to maintain the integrity of the leaderboard and your personal statistics.</Text>
          <Text style={styles.bullet}>• <Text style={styles.bold}>Device & Usage Data:</Text> We may collect anonymous diagnostic data to help us identify bugs and improve the app&apos;s performance.</Text>
        </View>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use your information exclusively to:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Save and sync your game progress across devices.</Text>
          <Text style={styles.bullet}>• Process in-app purchases and manage your virtual coin balance.</Text>
          <Text style={styles.bullet}>• Display your rank on global leaderboards (using your chosen Display Name).</Text>
          <Text style={styles.bullet}>• Provide customer support and respond to inquiries.</Text>
        </View>

        <Text style={styles.sectionTitle}>3. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          Cruxe utilizes trusted third-party services to operate the app:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• <Text style={styles.bold}>Supabase:</Text> For secure authentication and database hosting.</Text>
          <Text style={styles.bullet}>• <Text style={styles.bold}>RevenueCat:</Text> To securely process and validate your in-app coin purchases. RevenueCat retains purchase history associated with your anonymous or linked account identifier.</Text>
          <Text style={styles.bullet}>• <Text style={styles.bold}>Google/Apple Sign-In:</Text> For authenticating your identity if you choose to link an account.</Text>
          <Text style={styles.bullet}>• <Text style={styles.bold}>Sentry:</Text> For crash reporting and performance diagnostics. Reports include device model, OS version, and an anonymous account identifier so we can correlate one user&apos;s crashes. We do not send your device name, puzzle answers, or authentication tokens.</Text>
        </View>

        <Text style={styles.sectionTitle}>4. Data Security & Deletion</Text>
        <Text style={styles.paragraph}>
          We take reasonable measures to protect your information. You have the right to request the deletion of your account and associated data at any time. If you use a linked account, you can revoke access at the OS level (iOS Settings or Google Account Settings).
        </Text>

        <Text style={styles.sectionTitle}>5. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions or concerns regarding this Privacy Policy, please contact our support team.
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
  bold: {
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
});

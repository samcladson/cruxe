import { Stack } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { theme } from "../../constants/theme";

/**
 * Privacy Policy, shown from Profile.
 *
 * This must stay in step with web/privacy.html, which tells readers it mirrors
 * the copy in the app. They had drifted: the hosted page carried four
 * disclosures this screen did not — what we never collect, that the display
 * name is public on the leaderboard, the under-13 statement, and a contact
 * address. Those are the half a reader is most likely to want, so they are
 * added here rather than removed there.
 *
 * When editing either copy, edit both.
 */
export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title="Privacy Policy"
        subtitle="Last updated September 2026"
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.paragraph}>
          This policy explains what Cruxe collects, why, and who processes it. It mirrors the policy
          published on our website; if the two ever disagree, please tell us and we will correct it.
        </Text>

        <Text style={styles.sectionTitle}>1. What we collect</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Account data.</Text> An account is required to play. You
            create one with Google, Apple, or a one-time code sent to your email address. We store
            your email address, the name your provider gives us (if any), and an account identifier,
            so your progress follows you to any device you sign in on.
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Feedback you send.</Text> If you use Send feedback in the
            app, we store what you write along with your account identifier, app version and device
            platform, so we can reproduce the problem and reply. It is never shown to other players.
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Gameplay data.</Text> Puzzle completions, scores, solve
            times, streaks and coin balance. These make the leaderboard and your statistics work.
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Purchase records.</Text> If you buy a coin pack, we record
            that it happened so the coins can be granted and a refund honoured. We never see your
            card details &mdash; the app store handles payment.
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Diagnostics.</Text> Crash reports and basic device
            information (model, OS version), plus a record of which screens and actions preceded a
            crash. Your device name is deliberately removed before anything is sent.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>2. What we never collect</Text>
        <Text style={styles.paragraph}>
          No location, contacts, photos, microphone, calendar, browsing history, or advertising
          identifier. Cruxe contains no advertising and no advertising SDK.
        </Text>
        <Text style={styles.paragraph}>
          Your data is never used to generate puzzles or to train any AI model. Puzzles are created
          centrally before anyone plays them, from a fixed list of subjects, and nothing you do in
          the app feeds into that.
        </Text>

        <Text style={styles.sectionTitle}>3. Who processes your data</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Supabase</Text> &mdash; authentication and database hosting.
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>RevenueCat</Text> &mdash; validating in-app purchases.
            Receives your account identifier and purchase history.
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Sentry</Text> &mdash; crash reporting and diagnostics.
            Receives device model, OS version and your account identifier. We do not send your
            device name, puzzle answers, or authentication tokens.
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Google or Apple Sign-In</Text> &mdash; only if you choose to
            link an account.
          </Text>
        </View>
        <Text style={styles.paragraph}>
          We do not sell your data, and we do not share it for advertising.
        </Text>

        <Text style={styles.sectionTitle}>4. Your display name is public</Text>
        <Text style={styles.paragraph}>
          The name you choose appears on the global leaderboard alongside your score and streak.
          Nothing else about you is shown. You can change it at any time in your profile.
        </Text>

        <Text style={styles.sectionTitle}>5. Deleting your data</Text>
        <Text style={styles.paragraph}>
          Go to Profile &rarr; Delete account. This is immediate and permanent: your profile,
          progress, streak, coin balance and leaderboard entry are erased. If you use a linked
          account, you can also revoke access at the OS level (iOS Settings or Google Account
          Settings).
        </Text>
        <Text style={styles.paragraph}>
          Purchase records may be retained in anonymised form where tax and accounting law requires
          it. They cannot be linked back to you.
        </Text>

        <Text style={styles.sectionTitle}>6. Children</Text>
        <Text style={styles.paragraph}>
          Cruxe is not directed at children and we do not knowingly collect data from anyone under
          13.
        </Text>

        <Text style={styles.sectionTitle}>7. Contact</Text>
        <Text style={styles.paragraph}>
          Questions about your data:{" "}
          <Text style={styles.email} selectable>
            samcladson08@gmail.com
          </Text>
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
  content: {
    padding: 24,
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
  email: {
    color: theme.colors.textPrimary,
  },
});

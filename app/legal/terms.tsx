import { Stack } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { theme } from "../../constants/theme";

/**
 * Terms of Service, shown from Profile.
 *
 * This must stay in step with web/terms.html, which tells readers it mirrors
 * the copy in the app. They had drifted: this screen still claimed "all sales
 * are final and we do not offer refunds" while the web page described Google
 * Play's refund policy, and the server has handled refunds since the economy
 * rework — revenuecat-webhook debits coins on CANCELLATION and REFUND. The
 * app was the stale half, and a blanket no-refunds clause is unenforceable
 * against statutory rights in much of the world besides.
 *
 * When editing either copy, edit both.
 */
export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title="Terms of Service"
        subtitle="Last updated September 2026"
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.paragraph}>
          By using Cruxe you agree to these terms. They are deliberately short.
        </Text>

        <Text style={styles.sectionTitle}>1. Your account</Text>
        <Text style={styles.paragraph}>
          An account is required to play, created with Google, Apple, or a one-time code sent to
          your email address. You are responsible for activity on your account. Choose a display
          name that is not offensive or impersonating &mdash; names are validated, and we may reset
          one that is not.
        </Text>

        <Text style={styles.sectionTitle}>2. Coins</Text>
        <Text style={styles.paragraph}>
          Coins are a virtual in-game currency. They have no monetary value, cannot be exchanged
          for money, and cannot be transferred between accounts. You are buying a licence to use
          them within Cruxe, not property.
        </Text>
        <Text style={styles.paragraph}>
          Coins are earned by playing and may also be purchased. Purchased coins are granted by our
          server after the store confirms the transaction. If a purchase completes but coins do not
          appear, use Restore Purchases in the store, which reconciles anything missed.
        </Text>

        <Text style={styles.sectionTitle}>3. Refunds</Text>
        <Text style={styles.paragraph}>
          Purchases are handled by the app store you bought through and are subject to its refund
          policy. If a purchase is refunded, the corresponding coins are removed from your balance
          &mdash; including where they have already been spent, which can leave the balance negative
          until you earn it back.
        </Text>
        <Text style={styles.paragraph}>
          Deleting your account forfeits any remaining coins, purchased or earned. This is stated
          again at the point of deletion.
        </Text>

        <Text style={styles.sectionTitle}>4. Fair play</Text>
        <Text style={styles.paragraph}>
          Do not attempt to modify the app, forge scores, or manipulate the leaderboard. Scores are
          verified on our servers. Accounts found manipulating results may have scores removed or be
          suspended.
        </Text>

        <Text style={styles.sectionTitle}>5. Puzzle content</Text>
        <Text style={styles.paragraph}>
          Puzzles, clues and the notes shown after solving are generated with the help of AI and
          reviewed automatically rather than by hand. They are offered for enjoyment and general
          interest, not as a reference. Occasionally a clue or fact may be inaccurate or out of
          date, and you should not rely on them for anything that matters.
        </Text>
        <Text style={styles.paragraph}>
          If you spot something wrong, Send feedback from your profile &mdash; it reaches us
          directly and it is how these get fixed.
        </Text>

        <Text style={styles.sectionTitle}>6. Intellectual property</Text>
        <Text style={styles.paragraph}>
          The app, its trademarks, copyright, database rights and related intellectual property
          belong to the creators of Cruxe. You may not copy or modify the app or any part of it,
          extract its source code, or create derivative versions.
        </Text>

        <Text style={styles.sectionTitle}>7. Availability</Text>
        <Text style={styles.paragraph}>
          New puzzles are generated daily, but Cruxe is provided as-is and we do not guarantee
          uninterrupted availability. Occasionally a day&apos;s set may be delayed or reduced.
        </Text>

        <Text style={styles.sectionTitle}>8. Changes</Text>
        <Text style={styles.paragraph}>
          We may change these terms or the in-game economy &mdash; coin prices, rewards and free
          daily plays are all subject to balancing. Material changes will be noted in the app.
        </Text>

        <Text style={styles.sectionTitle}>9. Contact</Text>
        <Text style={styles.paragraph}>
          Questions about these terms:{" "}
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
  email: {
    color: theme.colors.textPrimary,
  },
});

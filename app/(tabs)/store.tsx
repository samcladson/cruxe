import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { CoinCounter } from "../../components/ui/CoinCounter";
import { theme } from "../../constants/theme";

export default function StoreScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Obsidian Store</Text>
        <CoinCounter />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.packCard}>
          <Text style={styles.packTitle}>Starter Pack</Text>
          <Text style={styles.packCoins}>500 Coins</Text>
          <Button title="$1.99" onPress={() => console.log("Buy Starter")} />
        </View>
        <View style={[styles.packCard, styles.popularCard]}>
          <Text style={styles.popularBadge}>MOST POPULAR</Text>
          <Text style={styles.packTitle}>Pro Pack</Text>
          <Text style={styles.packCoins}>1200 Coins</Text>
          <Button title="$4.99" onPress={() => console.log("Buy Pro")} />
        </View>
        <View style={styles.packCard}>
          <Text style={styles.packTitle}>Elite Pack</Text>
          <Text style={styles.packCoins}>3000 Coins</Text>
          <Button title="$9.99" onPress={() => console.log("Buy Elite")} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: theme.colors.bgPrimary,
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 28,
    color: theme.colors.textPrimary,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  packCard: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.borderRadius.card,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
  },
  popularCard: {
    borderColor: theme.colors.accentGold,
    ...theme.shadows.goldGlow,
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: 24,
    backgroundColor: theme.colors.accentGold,
    color: theme.colors.bgPrimary,
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    overflow: "hidden",
  },
  packTitle: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 18,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  packCoins: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 28,
    color: theme.colors.accentGold,
    marginBottom: 24,
  },
});

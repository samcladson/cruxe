import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { useUserStore } from "../../stores/userStore";

const PACKS = [
  { id: 1, title: "STARTER PACK", coins: 500, price: "$1.99", popular: false },
  { id: 2, title: "PRO PACK", coins: 1200, price: "$4.99", popular: true },
  { id: 3, title: "ELITE PACK", coins: 3000, price: "$9.99", popular: false },
  { id: 4, title: "EXPERT PACK", coins: 7500, price: "$19.99", popular: false },
];

export default function StoreScreen() {
  const coins = useUserStore((state) => state.profile.coins);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <View style={styles.balanceWrapper}>
          <View style={styles.balanceGlow} />
          <View style={styles.balanceCard}>
            <LinearGradient
              colors={["rgba(238, 205, 43, 0.15)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <MaterialIcons
                name="monetization-on"
                size={48}
                color={theme.colors.accentGold}
              />
              <Text style={styles.balanceAmount}>{coins.toLocaleString()}</Text>
            </View>
            <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>COIN PACKS</Text>
        </View>

        <View style={styles.list}>
          {PACKS.map((pack) => (
            <TouchableOpacity
              key={pack.id}
              style={[styles.packRow, pack.popular && styles.popularRow]}
              activeOpacity={0.8}
            >
              {pack.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}

              <View style={styles.rowLeft}>
                <View style={styles.iconContainer}>
                  <MaterialIcons
                    name="monetization-on"
                    size={28}
                    color={theme.colors.accentGold}
                  />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.packTitle}>{pack.title}</Text>
                  <Text style={styles.packCoins}>
                    {pack.coins.toLocaleString()}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.buyButton,
                  pack.popular && styles.buyButtonPopular,
                ]}
              >
                <Text
                  style={[
                    styles.buyButtonText,
                    pack.popular && styles.buyButtonTextPopular,
                  ]}
                >
                  {pack.price}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
    paddingBottom: 40,
    paddingTop: 16,
  },
  balanceWrapper: {
    marginBottom: 40,
  },
  balanceGlow: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    backgroundColor: theme.colors.accentGold,
    opacity: 0.15,
    borderRadius: 24,
    ...theme.shadows.goldGlow,
  },
  balanceCard: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  balanceAmount: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 48,
    color: theme.colors.textPrimary,
  },
  balanceLabel: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    color: theme.colors.accentGold,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  list: {
    gap: 16,
  },
  packRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  popularRow: {
    borderColor: theme.colors.accentGold,
    ...theme.shadows.goldGlow,
    marginTop: 12, // Extra space for the top badge
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    left: 24,
    backgroundColor: theme.colors.accentGold,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  popularBadgeText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    justifyContent: "center",
  },
  packTitle: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  packCoins: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  buyButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 100,
    alignItems: "center",
    minWidth: 80,
  },
  buyButtonPopular: {
    backgroundColor: theme.colors.accentGold,
  },
  buyButtonText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  buyButtonTextPopular: {
    color: "#000",
  },
});

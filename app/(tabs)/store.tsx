import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { fetchCurrentOffering, purchasePackage, restorePurchases } from "../../services/revenueCatService";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUserStore } from "../../stores/userStore";

// Mock packs removed. Packages are now fetched dynamically from RevenueCat.
// We expect package identifiers in RevenueCat to end with the coin amount, e.g., "cruxe_starter_500"

export default function StoreScreen() {
  const coins = useUserStore((state) => state.profile.coins);
  const addCoins = useUserStore((state) => state.addCoins);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    async function loadOfferings() {
      const current = await fetchCurrentOffering();
      setOffering(current);
      setLoading(false);
    }
    loadOfferings();
  }, []);

  const triggerHaptic = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  /**
   * Helper to extract the coin integer from the RevenueCat package identifier.
   * Assumes your Product IDs are structured like `com.cruxe.coins.500` or `starter_500`.
   */
  const extractCoinsFromId = (identifier: string): number => {
    const match = identifier.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (purchasing) return;
    triggerHaptic();
    setPurchasing(true);

    const { error, userCancelled } = await purchasePackage(pkg);
    setPurchasing(false);

    if (userCancelled) return;

    if (error) {
      Alert.alert("Purchase Failed", error.message);
      return;
    }

    // Success! Grant coins based on the product ID pattern
    const coinAmount = extractCoinsFromId(pkg.product.identifier);
    if (coinAmount > 0) {
      addCoins(coinAmount);
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Purchase Successful!", `You received ${coinAmount.toLocaleString()} coins.`);
    } else {
      Alert.alert("Purchase Successful!", "Your coins have been credited.");
    }
  };

  const handleRestore = async () => {
    triggerHaptic();
    const { error } = await restorePurchases();
    if (error) {
      Alert.alert("Restore Failed", error.message);
    } else {
      Alert.alert("Purchases Restored", "Your previous purchases have been synced.");
    }
  };

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

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.accentGold} style={{ marginTop: 40 }} />
        ) : offering && offering.availablePackages.length > 0 ? (
          <View style={styles.grid}>
            {offering.availablePackages.map((pkg) => {
              // Extract data from the RevenueCat package
              const coinAmount = extractCoinsFromId(pkg.product.identifier);
              // Hardcode 'popular' logic for the demo, or derive from package metadata later
              const isPopular = pkg.identifier === "$rc_lifetime" || pkg.identifier.includes("pro");

              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.packCard, isPopular && styles.popularCard]}
                  activeOpacity={0.8}
                  onPress={() => handlePurchase(pkg)}
                  disabled={purchasing}
                >
                  {isPopular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>POPULAR</Text>
                    </View>
                  )}

                  <View style={styles.cardIconWrap}>
                    <MaterialIcons
                      name="monetization-on"
                      size={28}
                      color={theme.colors.accentGold}
                    />
                  </View>

                  {/* RevenueCat product titles usually include the app name, e.g., "500 Coins (Cruxe)". Clean it up. */}
                  <Text style={styles.packTitle} numberOfLines={1}>
                    {pkg.product.title.toUpperCase().replace(/\s*\(.*\)/, "")}
                  </Text>
                  
                  <Text style={styles.packCoins}>
                    {coinAmount > 0 ? coinAmount.toLocaleString() : "---"}
                  </Text>

                  <View style={[styles.buyButton, isPopular && styles.buyButtonPopular]}>
                    <Text style={[styles.buyButtonText, isPopular && styles.buyButtonTextPopular]}>
                      {pkg.product.priceString}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={{ alignItems: "center", marginTop: 40, paddingHorizontal: 8 }}>
            <MaterialIcons name="storefront" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={{ color: theme.colors.textMuted, marginTop: 16, textAlign: "center", lineHeight: 22 }}>
              No coin packs to show yet. If you use a RevenueCat Test Store API key, add
              Test Store products to your current offering in the dashboard (see rev.cat/how-to-configure-offerings).
              {"\n\n"}
              Otherwise check your network and EXPO_PUBLIC_REVENUECAT_*_API_KEY in .env.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
          <Text style={styles.restoreText}>RESTORE PURCHASES</Text>
        </TouchableOpacity>
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
    paddingBottom: 20,
    paddingTop: 16,
  },
  balanceWrapper: {
    marginBottom: 32,
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
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  balanceAmount: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 40,
    color: theme.colors.textPrimary,
  },
  balanceLabel: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    color: theme.colors.accentGold,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  packCard: {
    width: "48%",
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 12,
  },
  popularCard: {
    borderColor: theme.colors.accentGold,
    ...theme.shadows.goldGlow,
    marginTop: 8,
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    backgroundColor: theme.colors.accentGold,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 10,
  },
  popularBadgeText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 8,
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  packTitle: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 9,
    color: theme.colors.textSecondary,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  packCoins: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  buyButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 100,
    alignItems: "center",
    width: "100%",
  },
  buyButtonPopular: {
    backgroundColor: theme.colors.accentGold,
  },
  buyButtonText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  buyButtonTextPopular: {
    color: "#000",
  },
  restoreButton: {
    marginTop: 32,
    alignItems: "center",
    paddingVertical: 12,
  },
  restoreText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    color: theme.colors.textMuted,
    textDecorationLine: "underline",
    letterSpacing: 2,
  },
});

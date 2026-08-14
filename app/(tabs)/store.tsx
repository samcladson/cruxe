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
import { syncPurchases } from "../../services/economyService";
import { supabase } from "../../services/supabaseClient";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUserStore } from "../../stores/userStore";

// Coin amounts come from the `coin_products` table, never from parsing the
// product identifier. The old regex granted 2 coins for a SKU like
// "cruxe_pack_v2", and let the client decide what a purchase was worth.

export default function StoreScreen() {
  const coins = useUserStore((state) => state.profile.coins);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** product_id -> coins, straight from the server catalogue. */
  const [products, setProducts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadOfferings() {
      const current = await fetchCurrentOffering();
      setOffering(current);
      setLoading(false);
    }
    loadOfferings();
  }, []);

  useEffect(() => {
    supabase
      .from("coin_products")
      .select("product_id, coins")
      .then(({ data }) => {
        if (data) {
          setProducts(
            Object.fromEntries(data.map((p) => [p.product_id, p.coins])),
          );
        }
      });
  }, []);

  const triggerHaptic = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  /**
   * Resolves true once the balance actually increases.
   *
   * Coins are granted by the RevenueCat webhook, not by this screen, so we
   * watch our own ledger — which RLS already lets us read — and fall back to
   * a direct balance check if the realtime message is missed.
   */
  const waitForCredit = (before: number, timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        supabase.removeChannel(channel);
        clearTimeout(timer);
        resolve(ok);
      };

      const channel = supabase
        .channel("own_ledger")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "coin_ledger",
            filter: `user_id=eq.${useUserStore.getState().profile.id}`,
          },
          (payload: any) => {
            useUserStore.getState().applyServerBalance(payload.new.balance_after);
            if (payload.new.balance_after > before) finish(true);
          },
        )
        .subscribe();

      const timer = setTimeout(async () => {
        await useUserStore.getState().refreshBalance();
        finish(useUserStore.getState().profile.coins > before);
      }, timeoutMs);
    });

  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (purchasing) return;
    triggerHaptic();
    setPurchasing(true);
    const balanceBefore = useUserStore.getState().profile.coins;

    const { error, userCancelled } = await purchasePackage(pkg);

    if (userCancelled) {
      setPurchasing(false);
      return;
    }
    if (error) {
      setPurchasing(false);
      Alert.alert("Purchase Failed", error.message);
      return;
    }

    // The store has the money. This screen grants nothing — it waits for the
    // webhook's credit to land, so force-quitting here cannot lose a purchase.
    setConfirming(true);
    const granted = await waitForCredit(balanceBefore, 12000);
    setConfirming(false);
    setPurchasing(false);

    if (granted) {
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Purchase complete", "Your coins have been added.");
    } else {
      // Never imply the money is lost — it is not. The webhook will land, and
      // Restore Purchases reconciles anything that does not.
      Alert.alert(
        "Purchase received",
        "Your coins are on the way and will appear shortly. " +
          "You can also tap Restore Purchases at any time.",
      );
    }
  };

  const handleRestore = async () => {
    triggerHaptic();
    setPurchasing(true);
    try {
      // Sync the RevenueCat SDK, then ask the server to credit anything a
      // dropped webhook missed. Consumables are not restorable by the store,
      // so without this second step the button could only ever be decorative.
      await restorePurchases();
      const { credited, balance } = await syncPurchases();
      useUserStore.getState().applyServerBalance(balance);
      Alert.alert(
        "Purchases restored",
        credited > 0
          ? `${credited} purchase${credited === 1 ? "" : "s"} credited.`
          : "Everything was already up to date.",
      );
    } catch (e: any) {
      Alert.alert("Restore Failed", e.message);
    } finally {
      setPurchasing(false);
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
              const coinAmount = products[pkg.product.identifier] ?? 0;
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

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing}
        >
          <Text style={styles.restoreText}>RESTORE PURCHASES</Text>
        </TouchableOpacity>
      </ScrollView>

      {confirming && (
        <View style={styles.confirmOverlay}>
          <ActivityIndicator size="large" color={theme.colors.accentGold} />
          <Text style={styles.confirmTitle}>Confirming your purchase</Text>
          <Text style={styles.confirmBody}>
            Your payment went through. We're adding your coins now.
          </Text>
        </View>
      )}
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
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  confirmTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginTop: 24,
    textAlign: "center",
  },
  confirmBody: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
});

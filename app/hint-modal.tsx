import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { Button } from "../components/ui/Button";
import { theme } from "../constants/theme";
import { usePuzzleStore } from "../stores/puzzleStore";
import { useUserStore } from "../stores/userStore";

export default function HintModal() {
  const { useHint } = usePuzzleStore();
  const { spendCoins, profile } = useUserStore();

  const handleReveal = () => {
    if (profile.coins >= 10) {
      if (spendCoins(10)) {
        useHint();
        router.back();
      }
    } else {
      // Could show a toast
      alert("Not enough coins!");
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backdrop} onPress={() => router.back()}>
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={StyleSheet.absoluteFill}
        />
      </Pressable>

      <Animated.View
        entering={SlideInDown.springify()}
        exiting={SlideOutDown}
        style={styles.sheet}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <Ionicons name="bulb" size={32} color={theme.colors.accentGold} />
          <Text style={styles.title}>Reveal Letter</Text>
        </View>

        <Text style={styles.desc}>
          Stuck on a tricky word? Reveal the currently selected letter for 10
          Obsidian Coins.
        </Text>

        <View style={styles.balanceRow}>
          <Text style={styles.balanceText}>Your Balance:</Text>
          <View style={styles.coinPill}>
            <Ionicons
              name="sparkles"
              size={12}
              color={theme.colors.accentGold}
            />
            <Text style={styles.coinText}>{profile.coins}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => router.back()}
            style={{ flex: 1 }}
          />
          <Button
            title={`Reveal (10)`}
            onPress={handleReveal}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: theme.colors.bgSecondary,
    borderTopLeftRadius: theme.borderRadius.modal,
    borderTopRightRadius: theme.borderRadius.modal,
    padding: 24,
    paddingBottom: 48,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.cellBorder,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 28,
    color: theme.colors.textPrimary,
  },
  desc: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.bgTertiary,
    padding: 16,
    borderRadius: theme.borderRadius.card,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
  },
  balanceText: {
    fontFamily: theme.typography.subheading.fontFamily,
    color: theme.colors.textPrimary,
  },
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.accentGold + "20",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  coinText: {
    fontFamily: theme.typography.heading.fontFamily,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
});

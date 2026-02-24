import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { theme } from "../../constants/theme";
import { useUserStore } from "../../stores/userStore";

export function CoinCounter() {
  const coins = useUserStore((state) => state.profile.coins);
  const scale = useSharedValue(1);

  React.useEffect(() => {
    // Animate when coins change
    scale.value = withSequence(
      withTiming(1.2, { duration: 150 }),
      withSpring(1, { damping: 10, stiffness: 100 }),
    );
  }, [coins, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.coinIcon, animatedStyle]}>
        <Ionicons name="sparkles" size={14} color={theme.colors.accentGold} />
      </Animated.View>
      <Text style={styles.text}>{coins.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: theme.colors.accentGoldMuted,
  },
  coinIcon: {
    marginRight: 6,
  },
  text: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: theme.typography.subheading.fontSize,
    color: theme.colors.accentGold,
    fontWeight: "700",
  },
});

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { theme } from "../../constants/theme";

export type ToastType = "success" | "error" | "info" | "coin";

export interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  onHide: (id: string) => void;
  duration?: number;
}

export function Toast({
  id,
  message,
  type = "info",
  onHide,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onHide(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onHide]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={theme.colors.accentGreen}
          />
        );
      case "error":
        return (
          <Ionicons
            name="alert-circle"
            size={20}
            color={theme.colors.accentRed}
          />
        );
      case "coin":
        return (
          <Ionicons
            name="logo-bitcoin"
            size={20}
            color={theme.colors.accentGold}
          />
        );
      default:
        return (
          <Ionicons
            name="information-circle"
            size={20}
            color={theme.colors.accentBlue}
          />
        );
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(15)}
      exiting={FadeOutUp.springify().damping(15)}
      style={styles.container}
    >
      <View style={styles.content}>
        {getIcon()}
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    left: 24,
    right: 24,
    alignItems: "center",
    zIndex: 9999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgSecondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  message: {
    marginLeft: 12,
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: theme.typography.subheading.fontSize,
    color: theme.colors.textPrimary,
  },
});

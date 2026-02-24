import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from "react-native";
import { theme } from "../../constants/theme";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "ghost";
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  onPress: () => void;
}

export function Button({
  title,
  variant = "primary",
  isLoading = false,
  style,
  textStyle,
  onPress,
  disabled,
  ...props
}: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isLoading && !disabled) {
      onPress();
    }
  };

  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isGhost = variant === "ghost";

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isGhost && styles.ghost,
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          color={isPrimary ? theme.colors.bgPrimary : theme.colors.accentGold}
        />
      ) : (
        <Text
          style={[
            styles.text,
            isPrimary && styles.textPrimary,
            isSecondary && styles.textSecondary,
            isGhost && styles.textGhost,
            (disabled || isLoading) && styles.textDisabled,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: theme.borderRadius.button,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing[24],
    flexDirection: "row",
  },
  primary: {
    backgroundColor: theme.colors.accentGold,
    ...theme.shadows.goldGlow,
  },
  secondary: {
    backgroundColor: theme.colors.bgTertiary,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: theme.typography.subheading.fontSize,
    letterSpacing: 0.5,
  },
  textPrimary: {
    color: theme.colors.bgPrimary,
  },
  textSecondary: {
    color: theme.colors.textPrimary,
  },
  textGhost: {
    color: theme.colors.accentGold,
  },
  textDisabled: {
    color: theme.colors.textMuted,
  },
});

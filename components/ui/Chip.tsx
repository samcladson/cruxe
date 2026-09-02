import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../constants/theme";

interface ChipProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  isActive?: boolean;
  onPress?: () => void;
  size?: "small" | "medium";
}

export function Chip({
  label,
  icon,
  color = theme.colors.textSecondary,
  isActive = false,
  onPress,
  size = "medium",
}: ChipProps) {
  const isSmall = size === "small";

  const content = (
    <View
      style={[
        styles.chip,
        isSmall && styles.chipSmall,
        isActive && { backgroundColor: color + "20", borderColor: color },
        !isActive && !onPress && { borderColor: theme.colors.cellBorder },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={isSmall ? 14 : 16}
          color={isActive ? color : theme.colors.textSecondary}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.label,
          isSmall && styles.labelSmall,
          isActive ? { color } : { color: theme.colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
      accessibilityRole="button" onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
    backgroundColor: theme.colors.bgTertiary,
  },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: theme.typography.caption.fontSize + 2,
  },
  labelSmall: {
    fontSize: theme.typography.caption.fontSize,
  },
});

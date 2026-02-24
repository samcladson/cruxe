import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LEVELS } from "../../constants/levels";
import { theme } from "../../constants/theme";
import { Difficulty } from "../../types/puzzle.types";

interface DifficultyBadgeProps {
  level: Difficulty;
}

export function DifficultyBadge({ level }: DifficultyBadgeProps) {
  const config = LEVELS[level] || LEVELS.easy;

  return (
    <View
      style={[
        styles.badge,
        { borderColor: config.color, backgroundColor: config.color + "15" },
      ]}
    >
      <Ionicons
        name={config.icon as any}
        size={12}
        color={config.color}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: config.color }]}>
        {config.label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "700",
  },
});

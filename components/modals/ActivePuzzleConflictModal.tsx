import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../constants/theme";
import { CATEGORIES } from "../../constants/categories";
import { Puzzle } from "../../types/puzzle.types";

interface ActivePuzzleConflictModalProps {
  visible: boolean;
  activePuzzle: Puzzle | null;
  onEnd: () => void;
  onResume: () => void;
  onDismiss: () => void;
}

/**
 * Shown when the player tries to start a different puzzle while one is
 * still in progress. There is only one active-puzzle slot, so this is the
 * point where the player chooses which one keeps it.
 */
export function ActivePuzzleConflictModal({
  visible,
  activePuzzle,
  onEnd,
  onResume,
  onDismiss,
}: ActivePuzzleConflictModalProps) {
  if (!activePuzzle) return null;

  const categoryLabel = (
    CATEGORIES[activePuzzle.category]?.title || activePuzzle.category
  ).toUpperCase();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconCircle}>
            <MaterialIcons
              name="play-circle-outline"
              size={32}
              color={theme.colors.accentGold}
            />
          </View>

          <Text style={styles.title}>Active Puzzle In Progress</Text>
          <Text style={styles.body}>
            You&apos;re still working on{" "}
            <Text style={styles.bodyEmphasis}>
              {categoryLabel} • {activePuzzle.difficulty.toUpperCase()}
            </Text>
            . Finish it before starting a new one, or end it to start fresh.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onResume}
            accessibilityRole="button"
            accessibilityLabel="Resume the active puzzle"
          >
            <MaterialIcons name="play-arrow" size={20} color="#000" />
            <Text style={styles.primaryBtnText}>RESUME PUZZLE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onEnd}
            accessibilityRole="button"
            accessibilityLabel="End the active puzzle and start the new one"
          >
            <Text style={styles.secondaryBtnText}>END PUZZLE & START NEW</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.borderRadius.modal,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(238, 205, 43, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.15)",
  },
  title: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 20,
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  bodyEmphasis: {
    color: "#fff",
    fontWeight: "bold",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    backgroundColor: theme.colors.accentGold,
    paddingVertical: 15,
    borderRadius: 16,
    marginBottom: 10,
    ...theme.shadows.goldGlow,
  },
  primaryBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  secondaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  secondaryBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: "bold",
    letterSpacing: 0.8,
  },
});

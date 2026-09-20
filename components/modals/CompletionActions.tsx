import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";

interface CompletionActionsProps {
  /**
   * Whether this is the last screen of the completion flow.
   *
   * Which screen that is varies — the takeaway is skipped for a puzzle with
   * no lesson, and the streak screen only appears on the day's first solve —
   * so the way out is attached to whichever screen ends the run rather than
   * to one particular screen.
   */
  isLast: boolean;
  onContinue: () => void;
  onPickAnother: () => void;
  onHome: () => void;
}

/** The footer of every completion screen: either a way on, or a way out. */
export function CompletionActions({
  isLast,
  onContinue,
  onPickAnother,
  onHome,
}: CompletionActionsProps) {
  if (!isLast) {
    return (
      <View style={styles.wrap}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.primaryBtnText}>CONTINUE</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#000" />
        </TouchableOpacity>
      </View>
    );
  }

  // Side by side rather than stacked. Two full-width blocks were a third of
  // the screen of chrome sitting under the content being read.
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={onHome}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <MaterialIcons
            name="home"
            size={18}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.ghostBtnText}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, styles.primaryInRow]}
          onPress={onPickAnother}
          accessibilityRole="button"
          accessibilityLabel="Next puzzle from today's collection"
        >
          <Text style={styles.primaryBtnText}>NEXT PUZZLE</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 12 : 24,
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: theme.colors.accentGold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    ...theme.shadows.goldGlow,
  },
  primaryBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  // Carries the same height as the primary button so the row reads as one
  // control, without competing with it for attention.
  ghostBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  ghostBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  primaryInRow: {
    flex: 1.7,
    width: undefined,
  },
});

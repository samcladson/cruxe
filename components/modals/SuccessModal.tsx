import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../constants/theme";
import { usePuzzleStore } from "../../stores/puzzleStore";

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SuccessModal({ visible, onClose }: SuccessModalProps) {
  const { activePuzzle, timer, getAccuracy, checksRemaining } =
    usePuzzleStore();

  if (!activePuzzle) return null;

  const handleReturn = () => {
    onClose();
    router.replace("/");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const accuracy = Math.round(getAccuracy() * 100);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={80} tint="dark" style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <MaterialIcons
              name="emoji-events"
              size={48}
              color={theme.colors.accentGold}
            />
          </View>

          <Text style={styles.title}>Puzzle Solved!</Text>
          <Text style={styles.subtitle}>
            {activePuzzle.category.toUpperCase()} •{" "}
            {activePuzzle.difficulty.toUpperCase()}
          </Text>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatTime(timer)}</Text>
              <Text style={styles.statLabel}>TIME</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{accuracy}%</Text>
              <Text style={styles.statLabel}>ACCURACY</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                +{activePuzzle.difficulty === "easy" ? 150 : 540}
              </Text>
              <Text style={styles.statLabel}>COINS</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleReturn}>
            <Text style={styles.primaryBtnText}>CONTINUE</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  card: {
    width: "85%",
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  title: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 28,
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 32,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 32,
    width: "100%",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  statValue: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 20,
    color: "#fff",
  },
  statLabel: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  primaryBtn: {
    backgroundColor: theme.colors.accentGold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1,
  },
});

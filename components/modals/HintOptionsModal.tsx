import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../constants/theme";
import { usePuzzleStore } from "../../stores/puzzleStore";

interface HintOptionsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HintOptionsModal({ visible, onClose }: HintOptionsModalProps) {
  const { useHint } = usePuzzleStore();

  const handleRevealCell = () => {
    // Reveal cell logic in puzzle store
    useHint();
    onClose();
  };

  const handleRevealWord = () => {
    // In the future this should loop through the selected word
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={80} tint="dark" style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <MaterialIcons
              name="close"
              size={24}
              color="rgba(255,255,255,0.5)"
            />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MaterialIcons
                name="emoji-objects"
                size={32}
                color={theme.colors.accentGold}
              />
            </View>
            <Text style={styles.title}>Need a Hint?</Text>
            <Text style={styles.subtitle}>
              Spend your earned coins to reveal letters or words.
            </Text>
          </View>

          <View style={styles.optionsList}>
            <TouchableOpacity
              style={styles.optionBtn}
              onPress={handleRevealCell}
            >
              <View style={styles.optionLeft}>
                <MaterialIcons name="font-download" size={24} color="#fff" />
                <View>
                  <Text style={styles.optionTitle}>Reveal Letter</Text>
                  <Text style={styles.optionDesc}>
                    Fills in the currently selected cell.
                  </Text>
                </View>
              </View>
              <View style={styles.priceTag}>
                <Text style={styles.priceText}>50</Text>
                <MaterialIcons
                  name="monetization-on"
                  size={14}
                  color={theme.colors.accentGold}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionBtn}
              onPress={handleRevealWord}
            >
              <View style={styles.optionLeft}>
                <MaterialIcons name="text-format" size={24} color="#fff" />
                <View>
                  <Text style={styles.optionTitle}>Reveal Word</Text>
                  <Text style={styles.optionDesc}>
                    Fills in the entire selected word.
                  </Text>
                </View>
              </View>
              <View style={styles.priceTag}>
                <Text style={styles.priceText}>150</Text>
                <MaterialIcons
                  name="monetization-on"
                  size={14}
                  color={theme.colors.accentGold}
                />
              </View>
            </TouchableOpacity>
          </View>
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
    width: "90%",
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 24,
    paddingTop: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  title: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 24,
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  optionsList: {
    gap: 12,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  optionTitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 2,
  },
  optionDesc: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  priceTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  priceText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
});

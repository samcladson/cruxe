import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CATEGORIES } from "../../constants/categories";
import { theme } from "../../constants/theme";
import { fetchAllPuzzlesForToday, PuzzleMeta } from "../../services/puzzleService";
import { useUserStore } from "../../stores/userStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { Difficulty, ENTRY_FEES } from "../../types/puzzle.types";

export default function CollectionScreen() {
  const [puzzles, setPuzzles] = useState<PuzzleMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Global Filters
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const userProfile = useUserStore((state) => state.profile);
  const spendCoins = useUserStore((state) => state.spendCoins);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);

  const triggerHaptic = () => {
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  useEffect(() => {
    async function loadCollection() {
      setLoading(true);
      try {
        const data = await fetchAllPuzzlesForToday(userProfile.id);
        setPuzzles(data);
      } catch (err) {
        console.warn("[CollectionScreen] Failed to fetch puzzles:", err);
        setPuzzles([]);
      } finally {
        setLoading(false);
      }
    }
    loadCollection();
  }, [userProfile.id]);

  // Compute unique categories from loaded puzzles for display in hero subtitle
  const uniqueCategories = [...new Set(puzzles.map((p) => p.category))];

  const filteredPuzzles = puzzles.filter((p) => {
    if (selectedDifficulty && p.difficulty.toLowerCase() !== selectedDifficulty.toLowerCase())
      return false;
    if (selectedSize && p.gridSize !== parseInt(selectedSize.split("x")[0]))
      return false;
    return true;
  });

  const difficulties: string[] = ["Easy", "Medium", "Hard", "Expert"];
  const gridSizes: string[] = ["6x6", "8x8", "10x10", "12x12"];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>

        {/* Title */}
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Today's Collection</Text>
        </View>

        {/* Filters */}
        <View style={styles.filtersSection}>
          <Text style={styles.filterLabel}>DIFFICULTY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            <TouchableOpacity
              style={[styles.pill, !selectedDifficulty && styles.pillActive]}
              onPress={() => {
                triggerHaptic();
                setSelectedDifficulty(null);
              }}
            >
              <Text style={[styles.pillText, !selectedDifficulty && styles.pillTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {difficulties.map((diff) => {
              const isActive = selectedDifficulty?.toLowerCase() === diff.toLowerCase();
              return (
                <TouchableOpacity
                  key={diff}
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => {
                    triggerHaptic();
                    setSelectedDifficulty(diff.toLowerCase() as Difficulty);
                  }}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {diff}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.filterLabel, { marginTop: 16 }]}>GRID SIZE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            <TouchableOpacity
              style={[styles.pill, !selectedSize && styles.pillActive]}
              onPress={() => {
                triggerHaptic();
                setSelectedSize(null);
              }}
            >
              <Text style={[styles.pillText, !selectedSize && styles.pillTextActive]}>All</Text>
            </TouchableOpacity>
            {gridSizes.map((size) => {
              const isActive = selectedSize === size;
              return (
                <TouchableOpacity
                  key={size}
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => {
                    triggerHaptic();
                    setSelectedSize(size);
                  }}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{size}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Puzzle List — exact same card design as category [id].tsx */}
        <View style={styles.puzzleList}>
          {loading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.accentGold}
              style={{ marginTop: 40 }}
            />
          ) : filteredPuzzles.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <MaterialIcons name="grid-off" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={{ color: theme.colors.textMuted, marginTop: 16 }}>
                No puzzles match your filters.
              </Text>
              <TouchableOpacity
                style={{ marginTop: 12 }}
                onPress={() => { 
                  triggerHaptic();
                  setSelectedDifficulty(null); 
                  setSelectedSize(null); 
                }}
              >
                <Text style={{ color: theme.colors.accentGold, fontFamily: theme.typography.cellLetter.fontFamily, fontWeight: "bold" }}>
                  Clear Filters
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredPuzzles.map((puzzle) => {
              const category = CATEGORIES[puzzle.category];
              return (
                <View key={puzzle.id} style={styles.card}>
                  {/* Top row: Category label + title + completion ring */}
                  <View style={styles.cardTopRow}>
                    <View>
                      <Text
                        style={
                          puzzle.isCompleted ? styles.cardDateActive : styles.cardDate
                        }
                      >
                        {category?.title.toUpperCase() || "GENERAL"}
                      </Text>
                      <Text style={styles.cardTitle}>
                        {puzzle.difficulty.charAt(0).toUpperCase() +
                          puzzle.difficulty.slice(1)}{" "}
                        Puzzle
                      </Text>
                    </View>
                    {puzzle.isCompleted ? (
                      <View style={styles.progressRingBox}>
                        <MaterialIcons
                          name="check"
                          size={20}
                          color={theme.colors.accentGold}
                        />
                      </View>
                    ) : (
                      <View style={styles.progressRingEmpty}>
                        <MaterialIcons
                          name="lock-open"
                          size={16}
                          color="rgba(255,255,255,0.4)"
                        />
                      </View>
                    )}
                  </View>

                  {/* Meta badges: grid size + time + difficulty */}
                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaBadge}>
                      <MaterialIcons
                        name="grid-on"
                        size={14}
                        color={theme.colors.textSecondary}
                      />
                      <Text style={styles.metaBadgeText}>
                        {puzzle.gridSize}x{puzzle.gridSize}
                      </Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <MaterialIcons
                        name="timer"
                        size={14}
                        color={theme.colors.textSecondary}
                      />
                      <Text style={styles.metaBadgeText}>
                        ~{Math.round(puzzle.estimatedTime / 60)} min
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.metaBadge,
                        puzzle.difficulty === "hard" || puzzle.difficulty === "expert"
                          ? styles.metaHard
                          : styles.metaMedium,
                      ]}
                    >
                      <Text
                        style={
                          puzzle.difficulty === "hard" || puzzle.difficulty === "expert"
                            ? styles.metaHardText
                            : styles.metaMediumText
                        }
                      >
                        {puzzle.difficulty.charAt(0).toUpperCase() +
                          puzzle.difficulty.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {/* Action Button — same as category screen */}
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => {
                      triggerHaptic();
                      if (puzzle.isCompleted) {
                        router.push({
                          pathname: "/game/generate",
                          params: { id: puzzle.id },
                        });
                        return;
                      }

                      const fee = ENTRY_FEES[puzzle.difficulty as Difficulty];
                      if (userProfile.coins < fee) {
                        Alert.alert(
                          "Not enough coins!",
                          `You need ${fee} coins to play a ${puzzle.difficulty} puzzle.`,
                          [{ text: "OK", style: "default" }]
                        );
                        return;
                      }

                      const success = spendCoins(fee);
                      if (success) {
                        router.push({
                          pathname: "/game/generate",
                          params: { id: puzzle.id },
                        });
                      }
                    }}
                  >
                    <MaterialIcons
                      name={puzzle.isCompleted ? "replay" : "play-arrow"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.cardActionText}>
                      {puzzle.isCompleted ? "REVIEW" : "PLAY"}
                    </Text>
                    {!puzzle.isCompleted && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                          backgroundColor: "rgba(238, 205, 43, 0.15)",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                          marginLeft: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: theme.typography.cellLetter.fontFamily,
                            fontSize: 10,
                            fontWeight: "bold",
                            color: theme.colors.accentGold,
                          }}
                        >
                          {ENTRY_FEES[puzzle.difficulty as Difficulty]}
                        </Text>
                        <MaterialIcons
                          name="monetization-on"
                          size={10}
                          color={theme.colors.accentGold}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// Styles mirror exactly the category [id].tsx screen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1810",
  },
  scrollArea: {
    flex: 1,
  },
  // --- Header ---
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  screenTitle: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 28,
    color: theme.colors.textPrimary,
  },
  // --- Filters ---
  filtersSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  filterLabel: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 2,
    marginBottom: 10,
  },
  pillRow: {
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: "#2c281b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pillActive: {
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.accentGold,
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  pillText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    fontWeight: "bold",
    color: "#c9c092",
  },
  pillTextActive: {
    color: "#1a1810",
  },
  // --- Puzzle List & Cards (identical to [id].tsx) ---
  puzzleList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#2c281b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardDate: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "rgba(201, 192, 146, 0.6)",
    marginBottom: 4,
  },
  cardDateActive: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    color: theme.colors.accentGold,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  progressRingBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingEmpty: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  metaBadgeText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metaHard: {
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  metaHardText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: theme.colors.accentGold,
  },
  metaMedium: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  metaMediumText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: "#c9c092",
  },
  cardActionBtn: {
    backgroundColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  cardActionText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
  },
});

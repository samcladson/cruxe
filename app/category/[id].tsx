import { MaterialIcons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CATEGORIES } from "../../constants/categories";
import { theme } from "../../constants/theme";
import { fetchCategoryPuzzles, PuzzleMeta } from "../../services/puzzleService";
import { useUserStore } from "../../stores/userStore";
import { Difficulty } from "../../types/puzzle.types";

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = id ? CATEGORIES[id as keyof typeof CATEGORIES] : null;

  const [puzzles, setPuzzles] = useState<PuzzleMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<Difficulty>("easy");
  const [selectedSize, setSelectedSize] = useState<string>("6x6");

  const userProfile = useUserStore((state) => state.profile);

  useEffect(() => {
    if (!category || !id) return;
    async function loadCategoryPuzzles() {
      setLoading(true);
      const data = await fetchCategoryPuzzles(id as any, userProfile.id);
      setPuzzles(data);
      setLoading(false);
    }
    loadCategoryPuzzles();
  }, [category, id, userProfile.id]);

  const filteredPuzzles = puzzles.filter((p) => {
    if (
      selectedDifficulty &&
      p.difficulty.toLowerCase() !== selectedDifficulty.toLowerCase()
    )
      return false;
    if (selectedSize && p.gridSize !== parseInt(selectedSize.split("x")[0]))
      return false;
    return true;
  });

  if (!category) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ color: "white" }}>Category not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: theme.colors.accentGold }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const difficulties = ["Easy", "Medium", "Hard", "Expert"];
  const gridSizes = ["6x6", "8x8", "10x10", "12x12"];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroRow}>
            <View
              style={[
                styles.heroIconBox,
                { borderColor: theme.colors.accentGold + "40" },
              ]}
            >
              <MaterialIcons
                name={category.icon as any}
                size={28}
                color={theme.colors.accentGold}
              />
            </View>
            <View>
              <Text style={styles.heroTitle}>{category.title}</Text>
              <Text style={styles.heroDesc}>{category.description}</Text>
            </View>
          </View>
        </View>

        {/* Filters Section */}
        <View style={styles.filtersSection}>
          {/* Difficulty Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.difficultyScroll}
          >
            {difficulties.map((diff) => {
              const isActive = selectedDifficulty === diff;
              return (
                <TouchableOpacity
                  key={diff}
                  style={[
                    styles.difficultyPill,
                    isActive && styles.difficultyPillActive,
                  ]}
                  onPress={() => setSelectedDifficulty(diff as Difficulty)}
                >
                  <Text
                    style={[
                      styles.difficultyText,
                      isActive && styles.difficultyTextActive,
                    ]}
                  >
                    {diff}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Grid Sizes */}
          <View style={styles.sizeContainer}>
            {gridSizes.map((size) => {
              const isActive = selectedSize === size;
              return (
                <TouchableOpacity
                  key={size}
                  style={[styles.sizeBtn, isActive && styles.sizeBtnActive]}
                  onPress={() => setSelectedSize(size)}
                >
                  <Text
                    style={[styles.sizeText, isActive && styles.sizeTextActive]}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Global Play Button */}
        <View style={styles.playActionSection}>
          <TouchableOpacity
            style={[
              styles.globalPlayBtn,
              (!selectedDifficulty || !selectedSize) &&
                styles.globalPlayBtnDisabled,
            ]}
            disabled={!selectedDifficulty || !selectedSize}
            onPress={() => {
              router.push({
                pathname: "/game/generate",
                params: {
                  category: id,
                  difficulty: selectedDifficulty?.toLowerCase(),
                  size: selectedSize ? parseInt(selectedSize.split("x")[0]) : 8,
                },
              });
            }}
          >
            <Text style={[styles.globalPlayBtnText]}>GENERATE & PLAY</Text>
          </TouchableOpacity>
        </View>

        {/* Puzzle List */}
        <View style={styles.puzzleList}>
          {loading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.accentGold}
              style={{ marginTop: 40 }}
            />
          ) : filteredPuzzles.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <MaterialIcons
                name="grid-off"
                size={48}
                color="rgba(255,255,255,0.1)"
              />
              <Text style={{ color: theme.colors.textMuted, marginTop: 16 }}>
                No puzzles match these filters
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedDifficulty("easy");
                  setSelectedSize("6x6");
                }}
              >
                <Text style={{ color: theme.colors.accentGold, marginTop: 12 }}>
                  Return to Defaults
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredPuzzles.map((puzzle) => (
              <View key={puzzle.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View>
                    <Text
                      style={
                        puzzle.isCompleted
                          ? styles.cardDateActive
                          : styles.cardDate
                      }
                    >
                      {category.title.toUpperCase()}
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
                        size={24}
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
                      puzzle.difficulty === "hard" ||
                      puzzle.difficulty === "expert"
                        ? styles.metaHard
                        : styles.metaMedium,
                    ]}
                  >
                    <Text
                      style={
                        puzzle.difficulty === "hard" ||
                        puzzle.difficulty === "expert"
                          ? styles.metaHardText
                          : styles.metaMediumText
                      }
                    >
                      {puzzle.difficulty.charAt(0).toUpperCase() +
                        puzzle.difficulty.slice(1)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.cardActionBtn}
                  onPress={() => {
                    router.push({
                      pathname: "/game/generate",
                      params: { id: puzzle.id },
                    });
                  }}
                >
                  <MaterialIcons
                    name={puzzle.isCompleted ? "replay" : "play-arrow"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.cardActionText}>
                    {puzzle.isCompleted ? "PLAY AGAIN" : "PLAY"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1810", // Deep rich charcoal from stitch
  },
  scrollArea: {
    flex: 1,
  },
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(238, 205, 43, 0.2)",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  heroTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  heroDesc: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: "#c9c092",
    marginTop: 4,
    fontWeight: "500",
  },
  filtersSection: {
    marginBottom: 24,
  },
  difficultyScroll: {
    paddingHorizontal: 24,
    gap: 8,
    paddingBottom: 4,
  },
  difficultyPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "#2c281b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  difficultyPillActive: {
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.accentGold,
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  difficultyText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    fontWeight: "bold",
    color: "#c9c092",
  },
  difficultyTextActive: {
    color: "#1a1810", // Dark text on gold
  },
  sizeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sizeBtn: {
    width: "22%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#2c281b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  sizeBtnActive: {
    backgroundColor: "#3a3524",
    borderColor: "rgba(238, 205, 43, 0.4)",
  },
  sizeText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    fontWeight: "bold",
    color: "#c9c092",
  },
  sizeTextActive: {
    color: theme.colors.accentGold,
  },
  puzzleList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#2c281b", // surface-dark
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
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  mockRing: {
    borderWidth: 3,
    borderColor: theme.colors.accentGold,
    borderRadius: 20,
    borderTopColor: "rgba(255,255,255,0.1)",
    borderRightColor: "rgba(255,255,255,0.1)",
    transform: [{ rotate: "45deg" }],
  },
  progressText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 9,
    fontWeight: "bold",
    color: "#fff",
  },
  progressRingEmpty: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
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
  playActionSection: {
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 32,
  },
  globalPlayBtn: {
    backgroundColor: theme.colors.accentGold,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  globalPlayBtnDisabled: {
    backgroundColor: "#2c281b",
    borderColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    shadowOpacity: 0,
  },
  globalPlayBtnText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1810",
    letterSpacing: 1.5,
  },
  globalPlayBtnTextDisabled: {
    color: "rgba(255,255,255,0.2)",
  },
});

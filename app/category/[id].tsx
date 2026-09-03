import { MaterialIcons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { CATEGORIES } from "../../constants/categories";
import { theme } from "../../constants/theme";
import {
  fetchCategoryPuzzles,
  puzzleTitle,
  PuzzleMeta,
} from "../../services/puzzleService";
import { useUserStore } from "../../stores/userStore";
import {
  enterPuzzle,
  getPlayStatus,
  PlayStatus,
} from "../../services/economyService";
import { supabase } from "../../services/supabaseClient";

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = id ? CATEGORIES[id as keyof typeof CATEGORIES] : null;

  const [puzzles, setPuzzles] = useState<PuzzleMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const userProfile = useUserStore((state) => state.profile);

  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  useEffect(() => {
    getPlayStatus()
      .then(setPlayStatus)
      .catch(() => setPlayStatus(null));
  }, []);

  // Overflow prices come from the server; a bundled copy would drift.
  const [overflowFees, setOverflowFees] = useState<Record<string, number>>({});
  useEffect(() => {
    supabase
      .from("economy_config")
      .select("value")
      .eq("key", "overflow_fees")
      .single()
      .then(({ data }) => setOverflowFees(data?.value ?? {}));
  }, []);

  useEffect(() => {
    if (!category || !id) return;
    async function loadCategoryPuzzles() {
      setLoading(true);
      try {
        const data = await fetchCategoryPuzzles(id as any, userProfile.id);
        setPuzzles(data);
      } catch (err) {
        console.warn("[CategoryScreen] Failed to fetch puzzles:", err);
        setPuzzles([]);
      } finally {
        setLoading(false);
      }
    }
    loadCategoryPuzzles();
    // Only fetch once when the category or user ID actually changes
  }, [id, userProfile.id]);

  const filteredPuzzles = puzzles;

  if (!category) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Category" showBack />
        <View style={styles.centred}>
          <MaterialIcons
            name="grid-off"
            size={48}
            color="rgba(255,255,255,0.1)"
          />
          <Text style={{ color: theme.colors.textMuted, marginTop: 16 }}>
            Category not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const difficulties = ["Easy", "Medium", "Hard", "Expert"];
  const gridSizes = ["6x6", "8x8", "10x10", "12x12"];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={category.title}
        subtitle={category.description}
        icon={category.icon as any}
        showBack
      />

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
      >
        {/* Filters Section and Global Play Button removed in V1 to focus on curated list */}

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
                No puzzles available for today yet.
              </Text>
            </View>
          ) : (
            filteredPuzzles.map((puzzle) => (
              <View key={puzzle.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  {/* Subject first, classification demoted to a kicker. */}
                  <View style={styles.cardHeading}>
                    <Text
                      style={
                        puzzle.isCompleted
                          ? styles.cardDateActive
                          : styles.cardDate
                      }
                    >
                      {puzzle.difficulty.toUpperCase()} • {puzzle.gridSize}×
                      {puzzle.gridSize}
                    </Text>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {puzzleTitle(puzzle)}
                    </Text>
                    {puzzle.standfirst ? (
                      <Text style={styles.cardStandfirst} numberOfLines={2}>
                        {puzzle.standfirst}
                      </Text>
                    ) : null}
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
                  onPress={async () => {
                    if (puzzle.isCompleted) {
                      router.push({
                        pathname: "/game/generate",
                        params: { id: puzzle.id },
                      });
                      return;
                    }

                    // The server owns the price and the balance check. A
                    // failure must not start the puzzle.
                    try {
                      const { balance } = await enterPuzzle(puzzle.id);
                      useUserStore.getState().applyServerBalance(balance);
                      setPlayStatus(await getPlayStatus());
                    } catch (e: any) {
                      Alert.alert("Can't start puzzle", e.message, [
                        { text: "OK", style: "default" },
                      ]);
                      return;
                    }

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
                        {playStatus && playStatus.free_plays_remaining > 0
                          ? "Free"
                          : (overflowFees[puzzle.difficulty] ?? 0)}
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
            ))
          )}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  scrollArea: {
    flex: 1,
  },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
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
    backgroundColor: theme.colors.bgSecondary,
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
    color: theme.colors.textSecondary,
  },
  difficultyTextActive: {
    color: theme.colors.bgPrimary,
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
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  sizeBtnActive: {
    backgroundColor: theme.colors.bgTertiary,
    borderColor: "rgba(238, 205, 43, 0.4)",
  },
  sizeText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
  },
  sizeTextActive: {
    color: theme.colors.accentGold,
  },
  puzzleList: {
    paddingHorizontal: 24,
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.bgSecondary,
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
  cardHeading: {
    // Leftover width, so a two-line title wraps rather than colliding with
    // the completion ring.
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  cardStandfirst: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
    marginTop: 4,
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
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.bgSecondary,
    borderColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    shadowOpacity: 0,
  },
  globalPlayBtnText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.bgPrimary,
    letterSpacing: 1.5,
  },
  globalPlayBtnTextDisabled: {
    color: "rgba(255,255,255,0.2)",
  },
});

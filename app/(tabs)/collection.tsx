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
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { CATEGORIES } from "../../constants/categories";
import { theme } from "../../constants/theme";
import {
  fetchAllPuzzlesForToday,
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
import { Difficulty } from "../../types/puzzle.types";
import { useSettingsStore } from "../../stores/settingsStore";

export default function CollectionScreen() {
  const [puzzles, setPuzzles] = useState<PuzzleMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Global Filters
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const userProfile = useUserStore((state) => state.profile);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);

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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="Today's Collection"
        subtitle="Every puzzle published today"
      />

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
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
                    {/* The subject leads; the classification becomes a
                        kicker. Difficulty still has to be visible — it drives
                        filtering, scoring and the free-play economy — it just
                        stops being the headline. */}
                    <View style={styles.cardHeading}>
                      <Text
                        style={
                          puzzle.isCompleted ? styles.cardDateActive : styles.cardDate
                        }
                      >
                        {category?.title.toUpperCase() || "GENERAL"} •{" "}
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
                    onPress={async () => {
                      triggerHaptic();
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
              );
            })
          )}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles mirror exactly the category [id].tsx screen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  scrollArea: {
    flex: 1,
  },
  // --- Header ---
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
    backgroundColor: theme.colors.bgSecondary,
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
    color: theme.colors.textSecondary,
  },
  pillTextActive: {
    color: theme.colors.bgPrimary,
  },
  // --- Puzzle List & Cards (identical to [id].tsx) ---
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
    // Takes the leftover width so a two-line title wraps instead of
    // colliding with the completion ring.
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
});

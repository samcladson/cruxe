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
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import {
  CompletionData,
  fetchCompletionById,
} from "../../services/puzzleService";
import { useUserStore } from "../../stores/userStore";

export default function ActivityReviewScreen() {
  const { id } = useLocalSearchParams();
  const profile = useUserStore((state) => state.profile);

  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id || typeof id !== "string") return;
      setLoading(true);

      try {
        const completionData = await fetchCompletionById(id, profile.id);
        if (completionData) {
          setCompletion(completionData);
        }
      } catch (err) {
        console.warn("[ActivityScreen] Failed to load activity data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, profile.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accentGold} />
      </SafeAreaView>
    );
  }

  if (!completion) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={{ color: theme.colors.textMuted }}>
          Could not load the activity details for this puzzle.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: theme.colors.accentGold, fontWeight: "bold" }}>
            GO BACK
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formattedDate = new Date(completion.puzzleDate).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance Insights</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Title Area */}
        <View style={styles.titleSection}>
          <View style={styles.heroIconBox}>
            <MaterialIcons
              name="analytics"
              size={48}
              color={theme.colors.accentGold}
            />
          </View>
          <Text style={styles.heroCategory}>
            {completion.category.toUpperCase()} •{" "}
            {completion.difficulty.toUpperCase()}
          </Text>
          <Text style={styles.heroDate}>{formattedDate}</Text>
        </View>

        {/* Primary Stats Grid */}
        <Text style={styles.sectionHeader}>Core Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <MaterialIcons
              name="check-circle"
              size={24}
              color={theme.colors.accentGreen}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.metricValue}>
              {Math.round(completion.accuracy * 100)}%
            </Text>
            <Text style={styles.metricLabel}>ACCURACY</Text>
          </View>

          <View style={styles.metricCard}>
            <MaterialIcons
              name="timer"
              size={24}
              color={theme.colors.textSecondary}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.metricValue}>
              {formatTime(completion.timeTaken)}
            </Text>
            <Text style={styles.metricLabel}>TIME TAKEN</Text>
          </View>

          <View style={styles.metricCard}>
            <MaterialIcons
              name="monetization-on"
              size={24}
              color={theme.colors.accentGold}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={[styles.metricValue, { color: theme.colors.accentGold }]}
            >
              +{completion.coinsEarned}
            </Text>
            <Text style={styles.metricLabel}>COINS SECURED</Text>
          </View>

          <View style={styles.metricCard}>
            <MaterialIcons
              name="emoji-objects"
              size={24}
              color="rgba(255,255,255,0.4)"
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.metricValue}>{completion.hintsUsed}</Text>
            <Text style={styles.metricLabel}>HINTS USED</Text>
          </View>
        </View>

        {/* Challenge Blueprint Details */}
        <Text style={styles.sectionHeader}>Challenge Blueprint</Text>
        <View style={styles.blueprintCard}>
          <View style={styles.blueprintRow}>
            <Text style={styles.blueprintLabel}>Grid Size</Text>
            <View style={styles.blueprintValueWrap}>
              <Text style={styles.blueprintValue}>
                {completion.gridSize} × {completion.gridSize}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.blueprintRow}>
            <Text style={styles.blueprintLabel}>Difficulty Tier</Text>
            <View style={styles.blueprintValueWrap}>
              <Text style={styles.blueprintValue}>
                {completion.difficulty.charAt(0).toUpperCase() +
                  completion.difficulty.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.blueprintRow}>
            <Text style={styles.blueprintLabel}>Total Score</Text>
            <View style={styles.blueprintValueWrap}>
              <Text style={styles.blueprintValue}>
                {completion.score.toLocaleString()} PTS
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },

  titleSection: {
    alignItems: "center",
    marginBottom: 40,
    marginTop: 20,
  },
  heroIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(238, 205, 43, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.15)",
  },
  heroCategory: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 22,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  heroDate: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 2,
  },

  sectionHeader: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 16,
    paddingLeft: 4,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 40,
  },
  metricCard: {
    width: "47%",
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  metricValue: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 26,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  metricLabel: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "bold",
    letterSpacing: 1.5,
  },

  blueprintCard: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  blueprintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    width: "100%",
    marginVertical: 16,
  },
  blueprintLabel: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  blueprintValueWrap: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  blueprintValue: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});

import { MaterialIcons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import { ShareCard, ShareCardData } from "../../../components/modals/ShareCard";
import { theme } from "../../../constants/theme";
import {
  CompletionData,
  fetchCompletionById,
  puzzleTitle,
} from "../../../services/puzzleService";
import { useUserStore } from "../../../stores/userStore";
import { ScreenBackdrop } from "../../../components/ui/ScreenBackdrop";
import { FadeScrollView } from "../../../components/ui/FadeScrollView";
import { activityLabel } from "../../../utils/activityLabel";
import { Category } from "../../../types/puzzle.types";

export default function ActivityReviewScreen() {
  const { id } = useLocalSearchParams();
  const profile = useUserStore((state) => state.profile);

  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);

  const shareCardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

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
        <ScreenBackdrop variant="activity" />
        <ActivityIndicator size="large" color={theme.colors.accentGold} />
      </SafeAreaView>
    );
  }

  if (!completion) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ScreenBackdrop variant="activity" />
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

  const { heading, detail } = activityLabel({
    title: completion.title ?? null,
    category: completion.category as Category,
    difficulty: completion.difficulty,
  });

  const shareCardData: ShareCardData = {
    puzzleTitle: puzzleTitle(completion),
    categoryLabel: completion.category.replace(/_/g, " ").toUpperCase(),
    difficultyLabel: completion.difficulty.toUpperCase(),
    gridSize: completion.gridSize,
    time: formatTime(completion.timeTaken),
    accuracy: Math.round(completion.accuracy * 100),
    points: completion.score,
    coins: completion.coinsEarned,
  };

  /**
   * Captures the off-screen ShareCard rather than this screen itself, which
   * carries the back gesture area and section chrome that don't belong in a
   * shared image.
   */
  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(
          "Sharing unavailable",
          "Sharing isn't supported on this device.",
        );
        return;
      }
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your result",
      });
    } catch {
      Alert.alert(
        "Couldn't share",
        "Something went wrong creating the share image. Try again.",
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenBackdrop variant="activity" />
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader
        title="Performance Insights"
        subtitle={[heading, detail, formattedDate].filter(Boolean).join(" • ")}
      />

      {/* Rendered off-screen — still laid out for view-shot to capture,
          never shown to the player. */}
      <View style={styles.offscreenShareCard} pointerEvents="none">
        <ShareCard ref={shareCardRef} data={shareCardData} />
      </View>

      <FadeScrollView contentContainerStyle={styles.scrollContent}>
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

        {/* The end of the page, like SHARE and HOME on the completion screen:
            part of the content, not fixed to the screen. */}
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          disabled={sharing}
          accessibilityRole="button"
          accessibilityLabel="Share your result"
        >
          {sharing ? (
            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          ) : (
            <MaterialIcons
              name="ios-share"
              size={18}
              color={theme.colors.textSecondary}
            />
          )}
          <Text style={styles.shareBtnText}>SHARE</Text>
        </TouchableOpacity>
      </FadeScrollView>
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
  scrollContent: {
    padding: 24,
    paddingTop: 0,
    paddingBottom: 40,
  },
  // The same outlined button as SHARE / HOME on the completion screen.
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  shareBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  offscreenShareCard: {
    position: "absolute",
    top: 0,
    left: -9999,
  },

  sectionHeader: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 16,
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

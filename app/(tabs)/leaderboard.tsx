/**
 * leaderboard.tsx — Global leaderboard screen.
 *
 * Fetches real player scores from the `leaderboard_view` in Supabase.
 * The view aggregates total score per user across all puzzle completions.
 * Falls back to an empty state with a retry button if the fetch fails.
 */

import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import {
  fetchLeaderboard,
  LeaderboardEntry,
} from "../../services/puzzleService";
import { useUserStore } from "../../stores/userStore";
import { formatCompactNumber } from "../../utils/formatNumber";

// ─── Podium Bar ───────────────────────────────────────────────────────

function PodiumBar({
  rank,
  entry,
  height,
  delay,
  isCurrentUser,
}: {
  rank: number;
  entry?: LeaderboardEntry;
  height: number;
  delay: number;
  isCurrentUser: boolean;
}) {
  const animatedHeight = useSharedValue(0);
  const animatedOpacity = useSharedValue(0);

  useEffect(() => {
    animatedHeight.value = withDelay(
      delay,
      withSpring(height, {
        mass: 1,
        damping: 18,
        stiffness: 120,
        overshootClamping: false,
      }),
    );
    animatedOpacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
  }, [entry?.userId]); // Re-trigger if the specific user sitting in this rank changes

  const barStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    opacity: animatedOpacity.value,
  }));

  const barColors: Record<number, string> = {
    1: theme.colors.accentGold,
    2: "#e5e7eb",
    3: "#ca8a04",
  };
  const barColor = barColors[rank] || theme.colors.accentGold;

  return (
    <View style={styles.podiumColumn}>
      <Animated.View
        entering={FadeInDown.delay(delay + 200)
          .duration(500)
          .springify()
          .mass(0.8)
          .damping(16)}
        style={styles.podiumAvatarWrap}
      >
        <View
          style={[
            styles.podiumAvatar,
            isCurrentUser && styles.podiumAvatarHighlight,
            !entry && { borderColor: "rgba(255,255,255,0.05)" },
          ]}
        >
          <MaterialIcons
            name="person"
            size={24}
            color={entry ? barColor : "rgba(255,255,255,0.2)"}
          />
        </View>
        <Text
          style={[
            styles.podiumName,
            !entry && { color: "rgba(255,255,255,0.3)" },
          ]}
          numberOfLines={1}
        >
          {entry ? entry.displayName : "---"}
          {isCurrentUser ? " ★" : ""}
        </Text>
        <Text
          style={[
            styles.podiumPoints,
            !entry && { color: "rgba(255,255,255,0.3)" },
          ]}
        >
          {entry ? formatCompactNumber(entry.totalScore) : "---"}
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.podiumBar,
          barStyle,
          { backgroundColor: barColor, opacity: entry ? 1 : 0.4 },
        ]}
      >
        <Text
          style={[
            styles.podiumRankText,
            !entry && { color: "rgba(0,0,0,0.3)" },
          ]}
        >
          {rank}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = useUserStore((s) => s.profile.id);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchLeaderboard(50);
      setEntries(data);
    } catch (err) {
      setError("Could not load leaderboard. Check connection and try again.");
      console.warn("[Leaderboard] Fetch failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  // ── Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Top players globally</Text>
        </View>
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={theme.colors.accentGold} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
        </View>
        <View style={styles.centred}>
          <MaterialIcons
            name="wifi-off"
            size={48}
            color={theme.colors.textMuted}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state is now handled inline within the list rendering

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top players globally</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={theme.colors.accentGold}
          />
        }
      >
        {/* Podium — always show */}
        <View style={styles.podiumSection}>
          <PodiumBar
            key={`podium-2-${topThree[1]?.userId || "empty"}`}
            rank={2}
            entry={topThree[1]}
            height={120}
            delay={200}
            isCurrentUser={topThree[1]?.userId === currentUserId}
          />
          <PodiumBar
            key={`podium-1-${topThree[0]?.userId || "empty"}`}
            rank={1}
            entry={topThree[0]}
            height={160}
            delay={0}
            isCurrentUser={topThree[0]?.userId === currentUserId}
          />
          <PodiumBar
            key={`podium-3-${topThree[2]?.userId || "empty"}`}
            rank={3}
            entry={topThree[2]}
            height={90}
            delay={400}
            isCurrentUser={topThree[2]?.userId === currentUserId}
          />
        </View>

        {/* Rest of the list */}
        <View style={styles.listSection}>
          {rest.length === 0 && (
            <View
              style={{
                paddingTop: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons
                name="format-list-bulleted"
                size={32}
                color="rgba(255,255,255,0.1)"
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{
                  fontFamily: theme.typography.body.fontFamily,
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                {entries.length === 0 ? "No players yet" : "No other players"}
              </Text>
            </View>
          )}
          {rest.map((player, index) => {
            const isMe = player.userId === currentUserId;
            return (
              <Animated.View
                key={player.userId}
                entering={FadeInDown.delay(600 + index * 60)
                  .duration(400)
                  .springify()
                  .damping(18)
                  .stiffness(150)}
                style={[styles.listRow, isMe && styles.listRowHighlight]}
              >
                <View style={styles.listRankBox}>
                  <Text style={styles.listRankText}>{player.rank}</Text>
                </View>
                <View style={styles.listAvatar}>
                  <MaterialIcons
                    name="person"
                    size={20}
                    color={
                      isMe ? theme.colors.accentGold : theme.colors.textMuted
                    }
                  />
                </View>
                <View style={styles.listPlayerInfo}>
                  <Text
                    style={[
                      styles.listPlayerName,
                      isMe && styles.listPlayerNameMe,
                    ]}
                  >
                    {player.displayName}
                    {isMe ? "  (You)" : ""}
                  </Text>
                  <View style={styles.listPlayerMeta}>
                    <MaterialIcons
                      name="local-fire-department"
                      size={12}
                      color={theme.colors.accentGold}
                    />
                    <Text style={styles.listStreakText}>
                      {player.streak} streak
                    </Text>
                  </View>
                </View>
                <View style={styles.listScoreBox}>
                  <Text style={styles.listScoreText}>
                    {formatCompactNumber(player.totalScore)}
                  </Text>
                  <Text style={styles.listScoreLabel}>PTS</Text>
                </View>
              </Animated.View>
            );
          })}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: theme.colors.bgPrimary,
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 32,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textSecondary,
  },
  content: { flexGrow: 1 },
  centred: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.accentGold,
  },
  retryText: {
    fontFamily: theme.typography.body.fontFamily,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  podiumSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    marginTop: 40,
    marginBottom: 40,
    height: 240,
    gap: 12,
  },
  podiumColumn: { alignItems: "center", width: "30%" },
  podiumAvatarWrap: { alignItems: "center", marginBottom: 12 },
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  podiumAvatarHighlight: {
    borderColor: theme.colors.accentGold,
    borderWidth: 2,
  },
  podiumName: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 12,
    color: theme.colors.textPrimary,
    marginBottom: 4,
    textAlign: "center",
  },
  podiumPoints: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  podiumBar: {
    width: "100%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 16,
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  podiumRankText: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 24,
    color: theme.colors.bgPrimary,
  },
  listSection: {
    paddingHorizontal: 24,
    backgroundColor: theme.colors.bgSecondary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    minHeight: 500,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgPrimary,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  listRowHighlight: {
    borderColor: theme.colors.accentGold,
    borderWidth: 1,
  },
  listRankBox: { width: 32, alignItems: "center" },
  listRankText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.textSecondary,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  listPlayerInfo: { flex: 1 },
  listPlayerName: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  listPlayerNameMe: { color: theme.colors.accentGold },
  listPlayerMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  listStreakText: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  listScoreBox: { alignItems: "flex-end" },
  listScoreText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
  },
  listScoreLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.accentGold,
    marginTop: 2,
  },
});

import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import { CATEGORIES } from "../../../constants/categories";
import { theme } from "../../../constants/theme";
import {
  ActivityItem,
  fetchRecentActivity,
} from "../../../services/puzzleService";
import { useUserStore } from "../../../stores/userStore";

/**
 * ActivityHistoryScreen — every puzzle this player has completed.
 *
 * This was a full-screen Modal launched from home, which meant it covered the
 * tab bar and needed a dismiss control of its own. As a route inside the tab
 * group it keeps the bottom navigation, so leaving is the same gesture as on
 * every other screen.
 */
export default function ActivityHistoryScreen() {
  const profile = useUserStore((state) => state.profile);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // On focus, so a puzzle solved and reviewed in this session shows up on
  // the way back rather than waiting for a remount.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        setLoading(true);
        try {
          const rows = await fetchRecentActivity(profile.id, 50);
          if (!cancelled) setActivity(rows);
        } catch (err) {
          console.warn("[Activity] Could not load history:", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [profile.id]),
  );

  /** Groups completions under the day they happened. */
  const byDate = activity.reduce<Record<string, ActivityItem[]>>((acc, row) => {
    const day = new Date(row.completedAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    (acc[day] ??= []).push(row);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="Activity History"
        subtitle={
          activity.length > 0
            ? `${activity.length} completed ${
                activity.length === 1 ? "puzzle" : "puzzles"
              }`
            : undefined
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator
            color={theme.colors.accentGold}
            style={{ marginTop: 40 }}
          />
        ) : activity.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons
              name="history"
              size={48}
              color="rgba(255,255,255,0.1)"
            />
            <Text style={styles.emptyText}>
              No completed puzzles yet. Solve one and it will show up here.
            </Text>
          </View>
        ) : (
          Object.entries(byDate).map(([day, rows]) => (
            <View key={day} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{day.toUpperCase()}</Text>
              <View style={styles.list}>
                {rows.map((row) => (
                  <ActivityRow key={row.id} item={row} />
                ))}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const categoryTitle = CATEGORIES[item.category]?.title || "General";
  const difficultyTitle =
    item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1);

  const mins = Math.floor(item.timeTaken / 60);
  const secs = item.timeTaken % 60;
  const time = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <TouchableOpacity
      style={styles.row}
      // item.id is the puzzle_completions primary key, which is what the
      // insights screen looks up — not the puzzle's own id.
      onPress={() => router.push(`/activity/${item.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${categoryTitle} ${difficultyTitle}, ${Math.round(
        item.accuracy * 100,
      )} percent accuracy, ${time}`}
    >
      <View style={styles.rowIcon}>
        <MaterialIcons
          name="check-circle"
          size={24}
          color={theme.colors.accentGold}
        />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>
          {categoryTitle} • {difficultyTitle}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.metaStrong}>
            {Math.round(item.accuracy * 100)}% Accuracy
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaTime}>{time}</Text>
        </View>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={20}
        color={theme.colors.textMuted}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  content: { padding: 24, paddingTop: 0 },

  dayGroup: { marginBottom: 24 },
  dayLabel: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 14,
    letterSpacing: 1,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  list: { gap: 12 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    padding: 14,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(238, 205, 43, 0.1)",
  },
  rowContent: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  metaStrong: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.accentGold,
  },
  metaDot: { color: theme.colors.textMuted, fontSize: 12 },
  metaTime: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
  },
});

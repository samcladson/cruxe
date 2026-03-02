import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedNumber } from "../../components/ui/AnimatedNumber";
import { CATEGORIES } from "../../constants/categories";
import { theme } from "../../constants/theme";
import {
  ActivityItem,
  fetchDailyChallenge,
  fetchRecentActivity,
  getDailyPlayerCount,
  PuzzleMeta,
} from "../../services/puzzleService";
import { supabase } from "../../services/supabaseClient";
import { useUserStore } from "../../stores/userStore";
import { formatCompactNumber } from "../../utils/formatNumber";

function PulseDot() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseDot, animatedStyle]} />;
}

export default function HomeScreen() {
  const profile = useUserStore((state) => state.profile);
  const [isCategoriesModalVisible, setIsCategoriesModalVisible] =
    useState(false);
  const [isActivityModalVisible, setIsActivityModalVisible] = useState(false);

  const [dailyPuzzle, setDailyPuzzle] = useState<PuzzleMeta | null>(null);
  const [dailyPlayerCount, setDailyPlayerCount] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    async function loadDaily() {
      const challenge = await fetchDailyChallenge(profile.id);
      if (challenge) {
        setDailyPuzzle(challenge);
      }
    }
    loadDaily();
  }, [profile.id]);

  useEffect(() => {
    if (!dailyPuzzle) return;

    // Load initial count
    getDailyPlayerCount(dailyPuzzle.id).then(setDailyPlayerCount);

    // Subscribe to new completions to increment live!
    const subscription = supabase
      .channel("daily_completions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "puzzle_completions",
          filter: `puzzle_id=eq.${dailyPuzzle.id}`,
        },
        () => {
          setDailyPlayerCount((prev) => prev + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [dailyPuzzle?.id]);

  useEffect(() => {
    async function loadActivity() {
      setLoadingActivity(true);
      const activity = await fetchRecentActivity(profile.id, 50);
      setRecentActivity(activity);
      setLoadingActivity(false);
    }
    loadActivity();
  }, [profile.id]);

  const startDailyPuzzle = () => {
    if (dailyPuzzle) {
      router.push({
        pathname: "/game/generate",
        params: { id: dailyPuzzle.id },
      });
    } else {
      router.push("/game/generate");
    }
  };

  // Helper date formatter
  const formattedDate = new Date()
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        {/* Top bar with branding and stats */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <PulseDot />
            <Text style={styles.brandText}>
              WELCOME,{" "}
              {profile.displayName
                ? profile.displayName.toUpperCase()
                : "PLAYER"}
            </Text>
          </View>

          <View style={styles.statsPill}>
            <View style={styles.statGroup}>
              <MaterialIcons
                name="local-fire-department"
                size={18}
                color={theme.colors.accentGold}
              />
              <Text style={styles.statText}>{profile.currentStreak}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statGroup}>
              <MaterialIcons
                name="monetization-on"
                size={18}
                color={theme.colors.accentGold}
              />
              <Text style={styles.statText}>
                {formatCompactNumber(profile.coins)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card: Daily Challenge */}
        <TouchableOpacity
          activeOpacity={dailyPuzzle?.isCompleted ? 1 : 0.9}
          onPress={dailyPuzzle?.isCompleted ? undefined : startDailyPuzzle}
          style={{ marginBottom: 32 }}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroCard}>
            <LinearGradient
              colors={["rgba(238, 205, 43, 0.1)", "transparent"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.heroHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={styles.dailyBadge}>
                  <Text style={styles.dailyBadgeText}>DAILY CHALLENGE</Text>
                </View>
                {dailyPuzzle?.isCompleted && (
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={theme.colors.accentGold}
                  />
                )}
              </View>
              <Text style={styles.heroDate}>{formattedDate}</Text>
            </View>

            {dailyPuzzle && dailyPlayerCount > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 24,
                }}
              >
                <PulseDot />
                <AnimatedNumber
                  value={dailyPlayerCount}
                  style={{
                    fontFamily: theme.typography.cellLetter.fontFamily,
                    fontSize: 12,
                    fontWeight: "bold",
                    color: theme.colors.accentGold,
                  }}
                />
                <Text
                  style={{
                    fontFamily: theme.typography.cellLetter.fontFamily,
                    fontSize: 8,
                    fontWeight: "bold",
                    color: theme.colors.textSecondary,
                    letterSpacing: 1,
                  }}
                >
                  PLAYED TODAY'S CHALLENGE
                </Text>
              </View>
            )}

            <View style={styles.heroTextGroup}>
              <Text style={styles.heroTitle}>
                {dailyPuzzle ? "General Knowledge" : "Retrieving Challenge..."}
              </Text>
              <View style={styles.heroDetailsRow}>
                <MaterialIcons
                  name="grid-on"
                  size={16}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.heroDetailsText}>
                  {dailyPuzzle
                    ? `${dailyPuzzle.gridSize}x${dailyPuzzle.gridSize} Grid`
                    : "Loading"}
                </Text>
                <Text style={styles.heroDetailsDot}>•</Text>
                <Text style={styles.heroDetailsText}>
                  {dailyPuzzle
                    ? dailyPuzzle.difficulty.charAt(0).toUpperCase() +
                      dailyPuzzle.difficulty.slice(1)
                    : "Loading"}
                </Text>
              </View>
            </View>

            {dailyPuzzle?.isCompleted ? (
              <View
                style={[
                  styles.heroButton,
                  {
                    backgroundColor: "rgba(255,255,255,0.05)",
                    justifyContent: "space-between",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.heroButtonText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  COMPLETED
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  {/* Timer */}
                  {dailyPuzzle.timeTaken != null && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <MaterialIcons
                        name="timer"
                        size={16}
                        color={theme.colors.textSecondary}
                      />
                      <Text
                        style={{
                          fontFamily: theme.typography.cellLetter.fontFamily,
                          fontSize: 14,
                          color: theme.colors.textSecondary,
                          fontWeight: "bold",
                        }}
                      >
                        {Math.floor(dailyPuzzle.timeTaken / 60)}:
                        {(dailyPuzzle.timeTaken % 60)
                          .toString()
                          .padStart(2, "0")}
                      </Text>
                    </View>
                  )}

                  {/* Accuracy Badge */}
                  {dailyPuzzle.accuracy != null && (
                    <View>
                      <Text
                        style={{
                          fontFamily: theme.typography.cellLetter.fontFamily,
                          fontSize: 14,
                          color: theme.colors.textSecondary,
                          fontWeight: "bold",
                        }}
                      >
                        {Math.round(dailyPuzzle.accuracy * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.heroButton}>
                <Text style={styles.heroButtonText}>PLAY TODAY</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#000" />
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Categories Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Categories</Text>
          <TouchableOpacity onPress={() => setIsCategoriesModalVisible(true)}>
            <Text style={styles.sectionLink}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {Object.entries(CATEGORIES)
            .slice(0, 4)
            .map(([key, cat]) => (
              <TouchableOpacity
                key={key}
                style={styles.categoryCard}
                onPress={() => router.push(`/category/${key}` as any)}
              >
                <View style={styles.catTop}>
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: cat.color + "20" },
                    ]}
                  >
                    <MaterialIcons
                      name={cat.icon as any}
                      size={24}
                      color={cat.color}
                    />
                  </View>
                  <Text style={styles.newText}>NEW</Text>
                </View>
                <View>
                  <Text style={styles.catTitle}>{cat.title}</Text>
                  <Text style={styles.catDesc}>{cat.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
        </View>

        {/* Recent Activity Section */}
        <View style={[styles.sectionHeader, { marginTop: 32 }]}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => setIsActivityModalVisible(true)}>
            <Text style={styles.sectionLink}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityList}>
          {loadingActivity ? (
            <ActivityIndicator
              color={theme.colors.accentGold}
              style={{ marginTop: 20 }}
            />
          ) : recentActivity.length === 0 ? (
            <Text
              style={{
                color: theme.colors.textMuted,
                textAlign: "center",
                marginTop: 20,
              }}
            >
              No recent puzzles completed.
            </Text>
          ) : (
            recentActivity.slice(0, 2).map((activity) => {
              const categoryTitle =
                CATEGORIES[activity.category]?.title || "General";
              const difficultyTitle =
                activity.difficulty.charAt(0).toUpperCase() +
                activity.difficulty.slice(1);

              const mins = Math.floor(activity.timeTaken / 60);
              const secs = activity.timeTaken % 60;
              const timeFormatted = `${mins}:${secs.toString().padStart(2, "0")}`;

              return (
                <TouchableOpacity
                  key={activity.id}
                  style={styles.activityRow}
                  onPress={() =>
                    router.push(`/activity/${activity.puzzleId}` as any)
                  }
                >
                  <View
                    style={[
                      styles.activityIcon,
                      { backgroundColor: "rgba(238, 205, 43, 0.1)" },
                    ]}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={24}
                      color={theme.colors.accentGold}
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>
                      {categoryTitle} • {difficultyTitle}
                    </Text>
                    <View style={styles.activityMeta}>
                      <Text
                        style={[
                          styles.metaStrong,
                          { color: theme.colors.accentGold },
                        ]}
                      >
                        {Math.round(activity.accuracy * 100)}% Accuracy
                      </Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaTime}>{timeFormatted}</Text>
                    </View>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Categories View All Modal */}
      <Modal
        visible={isCategoriesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsCategoriesModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All Categories</Text>
            <TouchableOpacity
              onPress={() => setIsCategoriesModalVisible(false)}
            >
              <MaterialIcons
                name="close"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <TouchableOpacity
                  key={key}
                  style={styles.categoryCard}
                  onPress={() => {
                    setIsCategoriesModalVisible(false);
                    // Slight delay to allow modal to close before routing
                    setTimeout(
                      () => router.push(`/category/${key}` as any),
                      150,
                    );
                  }}
                >
                  <View style={styles.catTop}>
                    <View
                      style={[
                        styles.iconWrap,
                        { backgroundColor: cat.color + "20" },
                      ]}
                    >
                      <MaterialIcons
                        name={cat.icon as any}
                        size={24}
                        color={cat.color}
                      />
                    </View>
                  </View>
                  <View>
                    <Text style={styles.catTitle}>{cat.title}</Text>
                    <Text style={styles.catDesc}>{cat.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Activity View All Modal */}
      <Modal
        visible={isActivityModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsActivityModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Activity History</Text>
            <TouchableOpacity onPress={() => setIsActivityModalVisible(false)}>
              <MaterialIcons
                name="close"
                size={24}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {Object.entries(
              recentActivity.reduce(
                (acc, curr) => {
                  const dateStr = new Date(curr.completedAt).toLocaleDateString(
                    "en-US",
                    {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    },
                  );
                  if (!acc[dateStr]) acc[dateStr] = [];
                  acc[dateStr].push(curr);
                  return acc;
                },
                {} as Record<string, typeof recentActivity>,
              ),
            ).map(([date, activities]) => (
              <View key={date} style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontFamily: theme.typography.heading.fontFamily,
                    fontSize: 14,
                    color: theme.colors.textSecondary,
                    marginBottom: 12,
                    letterSpacing: 1,
                  }}
                >
                  {date.toUpperCase()}
                </Text>
                <View style={styles.activityList}>
                  {activities.map((activity) => {
                    const categoryTitle =
                      CATEGORIES[activity.category]?.title || "General";
                    const difficultyTitle =
                      activity.difficulty.charAt(0).toUpperCase() +
                      activity.difficulty.slice(1);

                    const mins = Math.floor(activity.timeTaken / 60);
                    const secs = activity.timeTaken % 60;
                    const timeFormatted = `${mins}:${secs.toString().padStart(2, "0")}`;

                    return (
                      <TouchableOpacity
                        key={activity.id}
                        style={styles.activityRow}
                        onPress={() => {
                          setIsActivityModalVisible(false);
                          setTimeout(() => {
                            router.push(
                              `/activity/${activity.puzzleId}` as any,
                            );
                          }, 150);
                        }}
                      >
                        <View
                          style={[
                            styles.activityIcon,
                            { backgroundColor: "rgba(238, 205, 43, 0.1)" },
                          ]}
                        >
                          <MaterialIcons
                            name="check-circle"
                            size={24}
                            color={theme.colors.accentGold}
                          />
                        </View>
                        <View style={styles.activityContent}>
                          <Text style={styles.activityTitle}>
                            {categoryTitle} • {difficultyTitle}
                          </Text>
                          <View style={styles.activityMeta}>
                            <Text
                              style={[
                                styles.metaStrong,
                                { color: theme.colors.accentGold },
                              ]}
                            >
                              {Math.round(activity.accuracy * 100)}% Accuracy
                            </Text>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={styles.metaTime}>{timeFormatted}</Text>
                          </View>
                        </View>
                        <MaterialIcons
                          name="chevron-right"
                          size={20}
                          color={theme.colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: "rgba(10, 10, 10, 0.95)",
    zIndex: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accentGold,
  },
  brandText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    color: theme.colors.textSecondary,
    ...theme.shadows.goldGlow,
  },
  statsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  statGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: "bold",
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  heroGlow: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    backgroundColor: theme.colors.accentGold,
    opacity: 0.15,
    borderRadius: 24,
    ...theme.shadows.goldGlow,
  },
  heroCard: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 20,
    minHeight: 300,
    padding: 24,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dailyBadge: {
    backgroundColor: "rgba(238, 205, 43, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  dailyBadgeText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    color: theme.colors.accentGold,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  heroDate: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  heroTextGroup: {
    marginTop: 24,
  },
  heroTitle: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 28,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  heroDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroDetailsText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  heroDetailsDot: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 16,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.accentGold,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 24,
  },
  heroButtonText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  sectionLink: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    color: theme.colors.accentGold,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryCard: {
    width: "48%",
    height: 128,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 16,
    padding: 16,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 12,
  },
  catTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconWrap: {
    padding: 8,
    borderRadius: 8,
  },
  newText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: "bold",
  },
  catTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 14, // Adjusted from 16 to prevent overflow with NEW tag
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  catDesc: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  activityList: {
    gap: 12,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgSecondary,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  activityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaStrong: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    fontWeight: "bold",
  },
  metaDot: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 10,
  },
  metaTime: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  modalTitle: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 24,
    color: theme.colors.textPrimary,
  },
  modalContent: {
    padding: 24,
  },
});

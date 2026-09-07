import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { SFX } from "../../services/soundService";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useUserStore } from "../../stores/userStore";
import { formatCompactNumber } from "../../utils/formatNumber";

/**
 * SuccessModal — Full-screen puzzle completion & streak flow.
 *
 * Phase 1: Puzzle Stats (no scrolling, fits in screen)
 * Phase 2: If streak > 0, shows full-screen Duolingo-style streak flame on "Continue"
 */

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  coinsEarned?: number;
  scoreEarned?: number;
  isNewStreak?: boolean;
  /** ID of the next unsolved puzzle in the same category/difficulty */
  nextPuzzleId?: string | null;
  /**
   * Where the reward has got to.
   *
   * "syncing" is work in progress and says so; "queued" is a solve that
   * could not reach the server and will be retried. Collapsing the two into
   * one flag meant a request that was merely in flight displayed
   * "Pending — syncs later", which reads as a failure.
   */
  rewardState?: "syncing" | "granted" | "queued";
}

export function SuccessModal({
  visible,
  onClose,
  coinsEarned: earnedProp,
  scoreEarned = 0,
  isNewStreak = false,
  nextPuzzleId,
  rewardState = "granted",
}: SuccessModalProps) {
  const { activePuzzle, timer, getAccuracy } = usePuzzleStore();
  const { profile } = useUserStore();

  const [displayCoins, setDisplayCoins] = useState(0);
  const [showStreakScreen, setShowStreakScreen] = useState(false);

  const accuracy = Math.round(getAccuracy() * 100);
  // No invented fallback: the reward is whatever the server granted, and
  // zero until it says otherwise. The old 150/540 placeholder displayed
  // coins the player had not actually received.
  const finalCoins = earnedProp ?? 0;

  // Flame bounce animation for streak screen
  const flameScale = useSharedValue(0);

  useEffect(() => {
    if (visible && activePuzzle && !showStreakScreen) {
      // Coin counter animation
      const coinDelay = setTimeout(() => {
        let current = 0;
        const step = Math.ceil(finalCoins / 30);
        const interval = setInterval(() => {
          current += step;
          if (current >= finalCoins) {
            setDisplayCoins(finalCoins);
            clearInterval(interval);
          } else {
            setDisplayCoins(current);
          }
        }, 30);
        return () => clearInterval(interval);
      }, 800);
      return () => clearTimeout(coinDelay);
    } else if (!visible) {
      setDisplayCoins(0);
      setShowStreakScreen(false);
      flameScale.value = 0;
    }
  }, [visible, activePuzzle, finalCoins, showStreakScreen]);

  const handleFirstContinue = () => {
    // Only on the day's first solve. This used to fire whenever the streak
    // was above zero, which is after very nearly every puzzle — a
    // celebration shown that often stops being a celebration.
    if (isNewStreak && profile.currentStreak > 0) {
      // Move to Phase 2 (Streak Screen)
      setShowStreakScreen(true);
      flameScale.value = withDelay(
        300,
        withSpring(1, { damping: 12, stiffness: 100 }),
      );
    } else {
      handleFinalReturn();
    }
  };

  const handleFinalReturn = () => {
    onClose();
    router.replace("/(tabs)");
  };

  /**
   * Takes the player to where they can choose, rather than into a puzzle
   * chosen for them.
   *
   * This used to jump straight into the next unsolved puzzle in the same
   * category. Being handed a puzzle immediately after finishing one gives
   * the player no say in what they play next, and no moment to stop.
   */
  const handleBrowseMore = () => {
    const category = activePuzzle?.category;
    SFX.coinEarned();
    onClose();
    // Falls back to the full collection if the puzzle has somehow gone from
    // the store — either way the player lands somewhere they can choose.
    router.replace(
      category
        ? ({ pathname: "/category/[id]", params: { id: category } } as any)
        : ("/collection" as any),
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const flameAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));

  if (!activePuzzle) return null;

  // Facts are keyed by answer word. Ordering them by the puzzle's own clue
  // order rather than object order means they read in the sequence the
  // player just solved them.
  const facts = activePuzzle.lesson?.facts ?? {};
  const factEntries = activePuzzle.clues
    .map((clue) => [clue.answer, facts[clue.answer]] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));

  const hasLesson =
    Boolean(activePuzzle.lesson?.takeaway) || factEntries.length > 0;

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: STREAK SCREEN
  // ═══════════════════════════════════════════════════════════════════
  if (showStreakScreen) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
      >
        <SafeAreaView style={styles.streakScreen}>
          <StatusBar barStyle="light-content" />
          <View style={styles.streakCenter}>
            <Animated.View style={[styles.bigFlameWrap, flameAnimatedStyle]}>
              <MaterialIcons
                name="local-fire-department"
                size={120}
                color={theme.colors.accentGold}
              />
            </Animated.View>

            <Animated.Text
              entering={FadeInDown.delay(700).springify()}
              style={styles.streakCount}
            >
              {profile.currentStreak}
            </Animated.Text>

            <Animated.Text
              entering={FadeInDown.delay(800).springify()}
              style={styles.streakDaysLabel}
            >
              Day Streak!
            </Animated.Text>

            {isNewStreak && (
              <Animated.Text
                entering={FadeInDown.delay(1000).duration(400)}
                style={styles.streakSubtext}
              >
                Streak extended! Play tomorrow to keep it burning.
              </Animated.Text>
            )}
          </View>

          <Animated.View
            entering={FadeInUp.delay(1200)}
            style={styles.bottomActions}
          >
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleFinalReturn}
            >
              <Text style={styles.continueBtnText}>CONTINUE</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: PUZZLE STATS SCREEN
  // ═══════════════════════════════════════════════════════════════════
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />

        <View style={styles.centerContent}>
          {/* Main Trophy */}
          <Animated.View
            entering={ZoomIn.duration(600).springify().damping(12)}
            style={styles.trophyCircle}
          >
            <MaterialIcons
              name="emoji-events"
              size={48}
              color={theme.colors.accentGold}
            />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(200).duration(400)}
            style={styles.title}
          >
            Puzzle Solved!
          </Animated.Text>

          {/* Compact matrix of stats (2x2) */}
          <View style={styles.statsCardGrid}>
            <View style={styles.statsCardRow}>
              <Animated.View
                entering={FadeInUp.delay(300).duration(400)}
                style={styles.statBoxGrid}
              >
                <MaterialIcons
                  name="timer"
                  size={20}
                  color={theme.colors.accentGold}
                />
                <Text style={styles.statValue}>{formatTime(timer)}</Text>
                <Text style={styles.statLabel}>TIME</Text>
              </Animated.View>

              <View style={styles.statDividerGrid} />

              <Animated.View
                entering={FadeInUp.delay(400).duration(400)}
                style={styles.statBoxGrid}
              >
                <MaterialIcons
                  name="check-circle"
                  size={20}
                  color={theme.colors.accentGreen}
                />
                <Text style={styles.statValue}>{accuracy}%</Text>
                <Text style={styles.statLabel}>ACCURACY</Text>
              </Animated.View>
            </View>

            <View style={styles.statHorizontalDivider} />

            <View style={styles.statsCardRow}>
              <Animated.View
                entering={FadeInUp.delay(500).duration(400)}
                style={styles.statBoxGrid}
              >
                <MaterialIcons
                  name="star"
                  size={20}
                  color={theme.colors.accentGold}
                />
                <Text style={styles.statValue}>
                  {formatCompactNumber(scoreEarned)}
                </Text>
                <Text style={styles.statLabel}>POINTS</Text>
              </Animated.View>

              <View style={styles.statDividerGrid} />

              <Animated.View
                entering={FadeInUp.delay(600).duration(400)}
                style={styles.statBoxGrid}
              >
                {rewardState === "syncing" ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.accentGold}
                  />
                ) : (
                  <MaterialIcons
                    name={
                      rewardState === "queued" ? "cloud-off" : "monetization-on"
                    }
                    size={20}
                    color={
                      rewardState === "queued"
                        ? theme.colors.textMuted
                        : theme.colors.accentGold
                    }
                  />
                )}
                {rewardState === "syncing" ? (
                  <>
                    <Text
                      style={[
                        styles.statValue,
                        { color: theme.colors.textSecondary, fontSize: 14 },
                      ]}
                    >
                      Syncing
                    </Text>
                    <Text style={styles.statLabel}>AWARDING COINS</Text>
                  </>
                ) : rewardState === "queued" ? (
                  <>
                    <Text
                      style={[
                        styles.statValue,
                        { color: theme.colors.textMuted, fontSize: 14 },
                      ]}
                    >
                      Pending
                    </Text>
                    <Text style={styles.statLabel}>SYNCS LATER</Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.statValue,
                        { color: theme.colors.accentGold },
                      ]}
                    >
                      +{formatCompactNumber(displayCoins)}
                    </Text>
                    <Text style={styles.statLabel}>COINS</Text>
                  </>
                )}
              </Animated.View>
            </View>
          </View>

          {/* Compact details pill */}
          <Animated.View
            entering={FadeInUp.delay(700).duration(400)}
            style={styles.extraStats}
          >
            <Text style={styles.extraStatText}>
              {activePuzzle.category.replace(/_/g, " ").toUpperCase()} •{" "}
              {activePuzzle.difficulty.toUpperCase()} • {activePuzzle.gridSize}×
              {activePuzzle.gridSize}
            </Text>
          </Animated.View>
        </View>

        {/* ── What you learned ─────────────────────────────────────────
            Shown only after solving, which is the whole point: the puzzle
            stays a puzzle, and this is the reward for finishing it.
            Scrolls independently so a long list of facts cannot push the
            action buttons off the screen. */}
        {hasLesson ? (
          <Animated.View
            entering={FadeInUp.delay(800).duration(400)}
            style={styles.lessonSection}
          >
            <Text style={styles.lessonHeading}>
              {activePuzzle.title ?? "What you learned"}
            </Text>

            {activePuzzle.lesson?.takeaway ? (
              <Text style={styles.lessonTakeaway}>
                {activePuzzle.lesson.takeaway}
              </Text>
            ) : null}

            {factEntries.length > 0 ? (
              <ScrollView
                style={styles.lessonScroll}
                contentContainerStyle={styles.lessonScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {factEntries.map(([word, fact]) => (
                  <View key={word} style={styles.factRow}>
                    <Text style={styles.factWord}>{word}</Text>
                    <Text style={styles.factText}>{fact}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Action Buttons */}
        <Animated.View
          entering={FadeInUp.delay(900).duration(500).springify()}
          style={styles.bottomActions}
        >
          {nextPuzzleId ? (
            <>
              <TouchableOpacity
                style={styles.continueBtn}
                onPress={handleBrowseMore}
              >
                <Text style={styles.continueBtnText}>PICK ANOTHER</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleFirstContinue}
              >
                <Text style={styles.secondaryBtnText}>BACK TO HOME</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleFirstContinue}
            >
              <Text style={styles.continueBtnText}>CONTINUE</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#000" />
            </TouchableOpacity>
          )}
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    justifyContent: "space-between", // Pushes content and button to edges
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  trophyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(238, 205, 43, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.15)",
  },
  title: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 28,
    color: "#fff",
    marginBottom: 32,
  },
  statsCardGrid: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 20,
    overflow: "hidden",
  },
  statsCardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statBoxGrid: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  statDividerGrid: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statHorizontalDivider: {
    height: 1,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statValue: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 24,
    color: "#fff",
  },
  statLabel: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  lessonSection: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    // Bounded so a long fact list scrolls inside the section rather than
    // pushing the action buttons off the bottom of the screen.
    maxHeight: 260,
  },
  lessonHeading: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  lessonTakeaway: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  lessonScroll: {
    flexGrow: 0,
  },
  lessonScrollContent: {
    gap: 10,
    paddingBottom: 4,
  },
  factRow: {
    borderLeftWidth: 2,
    borderLeftColor: "rgba(238, 205, 43, 0.35)",
    paddingLeft: 10,
  },
  factWord: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: "bold",
    color: theme.colors.accentGold,
  },
  factText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  extraStats: {
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  extraStatText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 12 : 24,
    paddingTop: 12,
  },
  continueBtn: {
    backgroundColor: theme.colors.accentGold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    ...theme.shadows.goldGlow,
  },
  continueBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: "#000",
    fontWeight: "bold",
    letterSpacing: 1.5,
  },

  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  secondaryBtnText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: "600",
    letterSpacing: 1,
  },

  // Streak Screen Styles
  streakScreen: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    justifyContent: "space-between",
  },
  streakCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  bigFlameWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  streakCount: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 72,
    color: theme.colors.accentGold,
    lineHeight: 80,
  },
  streakDaysLabel: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 24,
    color: "#fff",
    marginBottom: 16,
  },
  streakSubtext: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 20,
  },
});

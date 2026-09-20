import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
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
import { LessonScreen, LessonFact } from "./LessonScreen";
import { CompletionActions } from "./CompletionActions";
import { clueReference } from "../../utils/clueLabel";
import { SFX } from "../../services/soundService";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useUserStore } from "../../stores/userStore";
import { formatCompactNumber } from "../../utils/formatNumber";

/**
 * SuccessModal — Full-screen puzzle completion flow.
 *
 * 1. Puzzle stats — time, accuracy, points, coins. Always shown.
 * 2. Streak flame — the day's first solve only.
 * 3. The takeaway and what you learned — only when the puzzle carries a
 *    lesson.
 *
 * Steps 2 and 3 are each conditional, so any of the three can be the last
 * screen. Only the last one offers a way out (PICK ANOTHER / BACK TO HOME);
 * the others offer CONTINUE. See `CompletionActions`.
 *
 * The lesson had its own section inside the stats screen until it was given
 * one of its own: a `flex: 1` stats block and a `maxHeight: 260` lesson block
 * could not both fit a short screen, and the stats overflowed and drew over
 * the facts.
 */

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  coinsEarned?: number;
  scoreEarned?: number;
  isNewStreak?: boolean;
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

/**
 * The completion flow, in order.
 *
 * "streak" appears only on the day's first solve and "lesson" only when the
 * puzzle carries one, so the run can be one, two or three screens long — and
 * which screen ends it changes with them. `CompletionActions` reads that from
 * the sequence rather than each screen assuming it knows.
 */
type Phase = "stats" | "streak" | "lesson";

export function SuccessModal({
  visible,
  onClose,
  coinsEarned: earnedProp,
  scoreEarned = 0,
  isNewStreak = false,
  rewardState = "granted",
}: SuccessModalProps) {
  const { activePuzzle, timer, getAccuracy } = usePuzzleStore();
  const { profile } = useUserStore();

  const [displayCoins, setDisplayCoins] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Facts are keyed by answer word. Walking the puzzle's own clues rather
  // than the facts object means they read in the sequence the player solved
  // them, and carry the clue reference that labels them on screen.
  const facts = activePuzzle?.lesson?.facts ?? {};
  const factEntries: LessonFact[] = (activePuzzle?.clues ?? [])
    .filter((clue) => Boolean(facts[clue.answer]))
    .map((clue) => ({
      reference: clueReference(clue.number, clue.direction),
      word: clue.answer,
      fact: facts[clue.answer],
    }));

  const hasLesson =
    Boolean(activePuzzle?.lesson?.takeaway) || factEntries.length > 0;

  const accuracy = Math.round(getAccuracy() * 100);
  // No invented fallback: the reward is whatever the server granted, and
  // zero until it says otherwise. The old 150/540 placeholder displayed
  // coins the player had not actually received.
  const finalCoins = earnedProp ?? 0;

  // Flame bounce animation for streak screen
  const flameScale = useSharedValue(0);

  // Only on the day's first solve. This used to fire whenever the streak was
  // above zero, which is after very nearly every puzzle — a celebration shown
  // that often stops being a celebration.
  const showStreak = isNewStreak && profile.currentStreak > 0;

  // The score first, then the streak it extended, then what the puzzle was
  // about. Built as a list so the last screen — the one that carries the way
  // out — is whichever one it actually is.
  const phases: Phase[] = [
    "stats",
    ...(showStreak ? (["streak"] as const) : []),
    ...(hasLesson ? (["lesson"] as const) : []),
  ];
  const phase = phases[Math.min(phaseIndex, phases.length - 1)];
  const isLast = phaseIndex >= phases.length - 1;

  const advance = () => setPhaseIndex((i) => i + 1);

  useEffect(() => {
    if (visible) setPhaseIndex(0);
  }, [visible]);

  useEffect(() => {
    if (phase === "streak") {
      flameScale.value = withDelay(
        300,
        withSpring(1, { damping: 12, stiffness: 100 }),
      );
    }
  }, [phase]);

  useEffect(() => {
    if (visible && activePuzzle && phase === "stats") {
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
      flameScale.value = 0;
    }
  }, [visible, activePuzzle, finalCoins, phase]);

  const handleFinalReturn = () => {
    onClose();
    router.replace("/(tabs)");
  };

  /**
   * Takes the player to today's collection, rather than into a puzzle chosen
   * for them.
   *
   * This used to jump straight into the next unsolved puzzle in the same
   * category, then to that category's own screen. Both narrowed the choice to
   * the subject they had just finished; the collection is the whole of today's
   * set, which is what "pick another" means.
   */
  const handleBrowseMore = () => {
    SFX.coinEarned();
    onClose();
    router.replace("/collection" as any);
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

  // ═══════════════════════════════════════════════════════════════════
  // LAST PHASE: WHAT YOU LEARNED
  // Shown after the score, and after the streak when there is one.
  // ═══════════════════════════════════════════════════════════════════
  if (phase === "lesson") {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <StatusBar barStyle="light-content" />
        <LessonScreen
          title={activePuzzle.title ?? "What you learned"}
          takeaway={activePuzzle.lesson?.takeaway}
          facts={factEntries}
          isLast={isLast}
          onContinue={advance}
          onPickAnother={handleBrowseMore}
          onHome={handleFinalReturn}
        />
      </Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // MIDDLE PHASE: STREAK SCREEN
  // The day's first solve only. Last screen when the puzzle has no lesson.
  // ═══════════════════════════════════════════════════════════════════
  if (phase === "streak") {
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

          <Animated.View entering={FadeInUp.delay(1200)}>
            <CompletionActions
              isLast={isLast}
              onContinue={advance}
              onPickAnother={handleBrowseMore}
              onHome={handleFinalReturn}
            />
          </Animated.View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2 of 3: PUZZLE STATS SCREEN
  // ═══════════════════════════════════════════════════════════════════
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />

        {/* Centres when there is room and scrolls when there is not. The
            stats used to sit in a plain flex:1 box that overflowed its
            bounds on a short screen and drew over whatever followed. */}
        <ScrollView
          style={styles.centerScroll}
          contentContainerStyle={styles.centerContent}
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>

        {/* Action Buttons */}
        <Animated.View entering={FadeInUp.delay(900).duration(500).springify()}>
          <CompletionActions
            isLast={isLast}
            onContinue={advance}
            onPickAnother={handleBrowseMore}
            onHome={handleFinalReturn}
          />
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
  centerScroll: {
    flex: 1,
  },
  centerContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
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

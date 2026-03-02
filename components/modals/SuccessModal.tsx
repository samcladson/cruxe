import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  BounceIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useUserStore } from "../../stores/userStore";
import { formatCompactNumber } from "../../utils/formatNumber";
// import { Audio } from "expo-av"; // Uncomment when adding actual audio files

/**
 * SuccessModal — Full-screen puzzle completion page.
 *
 * Implements a Duolingo-style sequenced animation reveal for Time, Accuracy,
 * Coins, and Current Streak. Includes hooks for `expo-av` sound effects.
 */

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  coinsEarned?: number;
  scoreEarned?: number;
  isNewStreak?: boolean;
}

export function SuccessModal({
  visible,
  onClose,
  coinsEarned: earnedProp,
  scoreEarned = 0,
  isNewStreak = false,
}: SuccessModalProps) {
  const { activePuzzle, timer, getAccuracy } = usePuzzleStore();
  const { profile } = useUserStore();

  const [displayCoins, setDisplayCoins] = useState(0);

  // --- Sound Effects Boilerplate ---
  // To enable: place .wav files in assets/sounds/ and uncomment this block.
  /*
  const playSound = async (type: "success" | "pop" | "count" | "streak") => {
    try {
      let file;
      switch (type) {
        case "success": file = require("../../assets/sounds/success.wav"); break;
        case "pop": file = require("../../assets/sounds/pop.wav"); break;
        case "count": file = require("../../assets/sounds/count.wav"); break;
        case "streak": file = require("../../assets/sounds/streak.wav"); break;
      }
      const { sound } = await Audio.Sound.createAsync(file);
      await sound.playAsync();
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  };
  */
  // Note: For now, we mock playSound so the app doesn't crash without the files
  const playSound = (type: string) => {
    // console.log("Simulated sound playing:", type);
  };

  const accuracy = Math.round(getAccuracy() * 100);
  const finalCoins =
    earnedProp ?? (activePuzzle?.difficulty === "easy" ? 150 : 540);

  // Trigger sound sequence matching the Reanimated layout enter animations
  useEffect(() => {
    if (visible && activePuzzle) {
      // 0ms: Trophy zooms in
      playSound("success");

      // 400ms: Stat boxes drop in
      setTimeout(() => playSound("pop"), 400);

      // 1000ms: Coin counting starts
      const coinDelay = setTimeout(() => {
        let current = 0;
        const step = Math.ceil(finalCoins / 40); // 40 steps max
        const interval = setInterval(() => {
          current += step;
          if (current >= finalCoins) {
            setDisplayCoins(finalCoins);
            clearInterval(interval);
          } else {
            playSound("count"); // Rapid tick
            setDisplayCoins(current);
          }
        }, 25);
        return () => clearInterval(interval);
      }, 1000);

      // 2200ms: Streak flame bounces in (only if a new streak was earned)
      if (isNewStreak) {
        setTimeout(() => playSound("streak"), 2200);
      }

      return () => clearTimeout(coinDelay);
    } else {
      setDisplayCoins(0); // Reset on close
    }
  }, [visible, activePuzzle, finalCoins]);

  if (!activePuzzle) return null;

  const handleReturn = () => {
    onClose();
    router.replace("/");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />

        <View style={styles.spacerTop} />

        <View style={styles.centerContent}>
          {/* Phase 1: Main Trophy / Success Icon */}
          <Animated.View
            entering={ZoomIn.duration(600).springify().damping(12)}
            style={styles.trophyCircle}
          >
            <MaterialIcons
              name="emoji-events"
              size={56}
              color={theme.colors.accentGold}
            />
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(200).duration(500)}
            style={styles.title}
          >
            Puzzle Solved!
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(300).duration(500)}
            style={styles.subtitle}
          >
            {activePuzzle.category.toUpperCase()} •{" "}
            {activePuzzle.difficulty.toUpperCase()}
          </Animated.Text>

          {/* Phase 2: Top Stats Grid (2x2 Neat Matrix) */}
          <View style={styles.statsCardGrid}>
            <View style={styles.statsCardRow}>
              <Animated.View
                entering={FadeInUp.delay(400).duration(400)}
                style={styles.statBoxGrid}
              >
                <MaterialIcons
                  name="timer"
                  size={24}
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
                  size={24}
                  color={theme.colors.accentGreen}
                />
                <Text style={styles.statValue}>{accuracy}%</Text>
                <Text style={styles.statLabel}>ACCURACY</Text>
              </Animated.View>
            </View>

            <View style={styles.statHorizontalDivider} />

            <View style={styles.statsCardRow}>
              <Animated.View
                entering={FadeInUp.delay(550).duration(400)}
                style={styles.statBoxGrid}
              >
                <MaterialIcons
                  name="star"
                  size={24}
                  color={theme.colors.accentGold}
                />
                <Text style={styles.statValue}>
                  {formatCompactNumber(scoreEarned)}
                </Text>
                <Text style={styles.statLabel}>POINTS</Text>
              </Animated.View>

              <View style={styles.statDividerGrid} />

              {/* Phase 3: Dynamic Coin Counter */}
              <Animated.View
                entering={FadeInUp.delay(700).duration(400)}
                style={styles.statBoxGrid}
              >
                <MaterialIcons
                  name="monetization-on"
                  size={24}
                  color={theme.colors.accentGold}
                />
                <Text
                  style={[styles.statValue, { color: theme.colors.accentGold }]}
                >
                  +{formatCompactNumber(displayCoins)}
                </Text>
                <Text style={styles.statLabel}>COINS</Text>
              </Animated.View>
            </View>
          </View>

          {/* Phase 3.5: Extra Stats Row */}
          <Animated.View
            entering={FadeInUp.delay(850).duration(400)}
            style={styles.extraStats}
          >
            <View style={styles.extraStatPill}>
              <MaterialIcons
                name="grid-on"
                size={14}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.extraStatText}>
                {activePuzzle.gridSize}×{activePuzzle.gridSize}
              </Text>
            </View>
            <View style={styles.extraStatPill}>
              <MaterialIcons
                name="text-fields"
                size={14}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.extraStatText}>
                {activePuzzle.totalWords} words
              </Text>
            </View>
            <View style={styles.extraStatPill}>
              <MaterialIcons
                name="emoji-objects"
                size={14}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.extraStatText}>
                {activePuzzle.hintsUsed} hints
              </Text>
            </View>
          </Animated.View>

          {/* Phase 4: Big Streak Focus */}
          {isNewStreak && (
            <Animated.View
              entering={BounceIn.delay(2200).duration(800)}
              style={styles.streakContainer}
            >
              <View style={styles.streakIconWrap}>
                <FontAwesome5
                  name="fire"
                  size={24}
                  color={theme.colors.bgPrimary}
                />
              </View>
              <View style={styles.streakTextCol}>
                <Text style={styles.streakLabel}>STREAK</Text>
                <View style={styles.streakValueRow}>
                  <Text style={styles.streakValue}>
                    {profile.currentStreak}
                  </Text>
                  <Text style={styles.streakDays}>DAYS</Text>
                </View>
              </View>
            </Animated.View>
          )}
        </View>

        <View style={styles.spacerBottom} />

        {/* Continue Button Drop-in */}
        <Animated.View
          entering={FadeInUp.delay(2800).duration(600).springify()}
          style={styles.bottomActions}
        >
          <TouchableOpacity style={styles.continueBtn} onPress={handleReturn}>
            <Text style={styles.continueBtnText}>CONTINUE</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#000" />
          </TouchableOpacity>
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
  },
  spacerTop: {
    flex: 1,
  },
  spacerBottom: {
    flex: 1,
  },
  centerContent: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  trophyCircle: {
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
  title: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 36,
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.accentGold,
    marginBottom: 36,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "bold",
  },
  statsCardGrid: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 32,
    overflow: "hidden",
  },
  statsCardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  statBoxGrid: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  statDividerGrid: {
    width: 1,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statHorizontalDivider: {
    height: 1,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statValue: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
  },
  statLabel: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
  extraStats: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 32,
  },
  extraStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  extraStatText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgSecondary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.accentGold,
    gap: 16,
    ...theme.shadows.goldGlow,
  },
  streakIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.accentGold,
    justifyContent: "center",
    alignItems: "center",
  },
  streakTextCol: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  streakLabel: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "bold",
    letterSpacing: 2,
    marginBottom: 2,
  },
  streakValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  streakValue: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 28,
    color: theme.colors.textPrimary,
    lineHeight: 32,
  },
  streakDays: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 14,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  continueBtn: {
    backgroundColor: theme.colors.accentGold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 18,
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
});

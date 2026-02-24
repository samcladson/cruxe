import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ProgressRing } from "../components/ui/ProgressRing";
import { theme } from "../constants/theme";
import { usePuzzleStore } from "../stores/puzzleStore";
import { useUserStore } from "../stores/userStore";

/**
 * VictoryModal — Puzzle Solved success screen.
 *
 * Displays after the player completes a crossword. Shows:
 * - Trophy / checkmark ring animation
 * - Stats: time taken, accuracy %, hints used
 * - Calculated total points with difficulty multiplier
 * - Coin reward badge
 * - Current streak card
 * - Play Next / Share Result / Home action buttons
 */
export default function VictoryModal() {
  const { activePuzzle, timer, getAccuracy } = usePuzzleStore();
  const { profile, addCoins, incrementStreak, completePuzzle } = useUserStore();

  /** Coin reward based on difficulty tier */
  const coinReward = useMemo(() => {
    switch (activePuzzle?.difficulty) {
      case "expert":
        return 200;
      case "hard":
        return 100;
      case "medium":
        return 50;
      default:
        return 25;
    }
  }, [activePuzzle?.difficulty]);

  /** Difficulty multiplier for the points formula */
  const difficultyMultiplier = useMemo(() => {
    switch (activePuzzle?.difficulty) {
      case "expert":
        return 3;
      case "hard":
        return 2;
      case "medium":
        return 1.5;
      default:
        return 1;
    }
  }, [activePuzzle?.difficulty]);

  /** Accuracy value (0–1) at time of completion */
  const accuracy = useMemo(() => getAccuracy(), []);

  /** Total points calculation:
   *  base  = correctCells × 10
   *  bonus = max(0, 600 - timer) × 2   (reward for finishing under 10 min)
   *  penalty = hintsUsed × 50
   *  total = (base + bonus - penalty) × difficultyMultiplier
   */
  const totalPoints = useMemo(() => {
    if (!activePuzzle) return 0;

    // Count total fillable cells for scoring
    let fillableCells = 0;
    activePuzzle.grid.forEach((row) => {
      row.forEach((cell) => {
        if (!cell.isBlocked) fillableCells++;
      });
    });

    const correctCellCount = Math.round(accuracy * fillableCells);
    const base = correctCellCount * 10;
    const timeBonus = Math.max(0, 600 - timer) * 2;
    const hintPenalty = activePuzzle.hintsUsed * 50;
    const raw = Math.max(0, base + timeBonus - hintPenalty);

    return Math.round(raw * difficultyMultiplier);
  }, [activePuzzle, accuracy, timer, difficultyMultiplier]);

  /** Format seconds into mm:ss display string */
  const formattedTime = useMemo(() => {
    const mins = Math.floor(timer / 60);
    const secs = timer % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [timer]);

  /** Format accuracy as integer percentage string */
  const accuracyPercent = `${Math.round(accuracy * 100)}%`;

  /** Process end-game rewards (runs once on mount) */
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (activePuzzle) {
      incrementStreak();
      addCoins(coinReward);
      completePuzzle(
        activePuzzle.category,
        timer,
        activePuzzle.totalWords, // Assuming 100% correct if puzzle is solved
        activePuzzle.totalWords,
      );
    }
  }, []);

  /** Share the result text with system share sheet */
  const handleShare = async () => {
    try {
      await Share.share({
        message: `🏆 Puzzle Solved on Cruxe!\n\n⏱ Time: ${formattedTime}\n🎯 Accuracy: ${accuracyPercent}\n⭐ Points: ${totalPoints.toLocaleString()}\n🔥 Streak: ${profile.currentStreak} days\n\nPlay Cruxe — the ultimate crossword challenge!`,
      });
    } catch {
      // User cancelled share
    }
  };

  return (
    <View style={styles.container}>
      {/* Solid dark backdrop with fade-in */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.backdrop} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ─── Trophy / Check-mark Ring ─── */}
        <Animated.View
          entering={FadeInDown.delay(200).springify().damping(14)}
          style={styles.trophyContainer}
        >
          <ProgressRing
            progress={1}
            size={100}
            strokeWidth={5}
            color={theme.colors.accentGold}
          />
          <View style={styles.trophyIconOverlay}>
            <MaterialIcons
              name="check"
              size={44}
              color={theme.colors.accentGold}
            />
          </View>
        </Animated.View>

        {/* ─── Heading ─── */}
        <Animated.View
          entering={FadeInDown.delay(350).springify().damping(14)}
          style={styles.headingBlock}
        >
          <Text style={styles.headingTitle}>PUZZLE SOLVED!</Text>
          <Text style={styles.headingSubtitle}>EXCELLENT WORK</Text>
        </Animated.View>

        {/* ─── Stats Row Card ─── */}
        <Animated.View
          entering={FadeInDown.delay(500).springify().damping(14)}
          style={styles.statsCard}
        >
          <StatItem label="TIME" value={formattedTime} />
          <View style={styles.statDivider} />
          <StatItem label="ACCURACY" value={accuracyPercent} />
          <View style={styles.statDivider} />
          <StatItem
            label="HINTS"
            value={String(activePuzzle?.hintsUsed ?? 0)}
          />
        </Animated.View>

        {/* ─── Total Points ─── */}
        <Animated.View
          entering={FadeInDown.delay(650).springify().damping(14)}
          style={styles.pointsBlock}
        >
          <Text style={styles.pointsValue}>{totalPoints.toLocaleString()}</Text>
          <Text style={styles.pointsLabel}>TOTAL POINTS</Text>
        </Animated.View>

        {/* ─── Coin Reward Badge ─── */}
        <Animated.View
          entering={FadeInDown.delay(800).springify().damping(14)}
          style={styles.coinBadge}
        >
          <MaterialIcons
            name="monetization-on"
            size={18}
            color={theme.colors.accentGreen}
          />
          <Text style={styles.coinText}>+{coinReward} coins</Text>
        </Animated.View>

        {/* ─── Streak Card ─── */}
        <Animated.View
          entering={FadeInDown.delay(950).springify().damping(14)}
          style={styles.streakCard}
        >
          <Text style={styles.streakEmoji}>🔥</Text>
          <View style={styles.streakTextGroup}>
            <Text style={styles.streakTitle}>
              {profile.currentStreak} Day Streak!
            </Text>
            <Text style={styles.streakSubtitle}>Keep the fire burning.</Text>
          </View>
        </Animated.View>

        {/* ─── Action Buttons ─── */}
        <Animated.View
          entering={FadeInDown.delay(1100).springify().damping(14)}
          style={styles.actionsBlock}
        >
          {/* Primary: Play Next */}
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace("/(tabs)");
            }}
          >
            <MaterialIcons
              name="play-arrow"
              size={22}
              color={theme.colors.bgPrimary}
            />
            <Text style={styles.primaryButtonText}>PLAY NEXT</Text>
          </TouchableOpacity>

          {/* Secondary row: Share + Home */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleShare();
              }}
            >
              <MaterialIcons
                name="share"
                size={18}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.secondaryButtonText}>SHARE RESULT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace("/(tabs)");
              }}
            >
              <MaterialIcons
                name="home"
                size={18}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.secondaryButtonText}>HOME</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ─── Stat Item Sub-component ─── */

interface StatItemProps {
  label: string;
  value: string;
}

/**
 * Individual stat metric rendered inside the stats row card.
 * Shows a bold value with a muted label beneath.
 */
function StatItem({ label, value }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  /* Layout */
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 40,
  },

  /* Trophy ring */
  trophyContainer: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  trophyIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Heading */
  headingBlock: {
    alignItems: "center",
    marginBottom: 28,
  },
  headingTitle: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 32,
    color: theme.colors.accentGold,
    letterSpacing: 1,
    textAlign: "center",
  },
  headingSubtitle: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 13,
    color: theme.colors.textSecondary,
    letterSpacing: 2,
    marginTop: 4,
  },

  /* Stats row card */
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
    paddingVertical: 18,
    paddingHorizontal: 12,
    width: "100%",
    marginBottom: 28,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  statValue: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.cellBorder,
  },

  /* Total points */
  pointsBlock: {
    alignItems: "center",
    marginBottom: 8,
  },
  pointsValue: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 52,
    color: theme.colors.accentGold,
    letterSpacing: 1,
  },
  pointsLabel: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 12,
    color: theme.colors.textSecondary,
    letterSpacing: 2,
    marginTop: 2,
  },

  /* Coin badge */
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    marginBottom: 24,
  },
  coinText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 14,
    color: theme.colors.accentGreen,
  },

  /* Streak card */
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
    paddingVertical: 16,
    paddingHorizontal: 20,
    width: "100%",
    marginBottom: 28,
    gap: 14,
  },
  streakEmoji: {
    fontSize: 28,
  },
  streakTextGroup: {
    flex: 1,
  },
  streakTitle: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  streakSubtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  /* Action buttons */
  actionsBlock: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: theme.borderRadius.button,
    backgroundColor: theme.colors.accentGold,
    gap: 8,
    ...theme.shadows.goldGlow,
  },
  primaryButtonText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 16,
    color: theme.colors.bgPrimary,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: theme.borderRadius.button,
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 1,
    borderColor: theme.colors.cellBorder,
    gap: 8,
  },
  secondaryButtonText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 13,
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },
});

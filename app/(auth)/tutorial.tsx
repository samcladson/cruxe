import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActiveClueBar } from "../../components/clues/ActiveClueBar";
import { CluePanel } from "../../components/clues/CluePanel";
import { CrosswordGrid } from "../../components/grid/CrosswordGrid";
import { CoachBar } from "../../components/tutorial/CoachBar";
import { Button } from "../../components/ui/Button";
import { theme } from "../../constants/theme";
import {
  TUTORIAL_PUZZLE,
  TUTORIAL_REVERSE_CLUE_IDS,
} from "../../constants/tutorialPuzzle";
import { track } from "../../services/analyticsService";
import {
  getLinkedProviders,
  linkGoogleAccount,
} from "../../services/authService";
import { SFX } from "../../services/soundService";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useSettingsStore } from "../../stores/settingsStore";

/**
 * TutorialScreen — a bundled warm-up puzzle with non-blocking coaching.
 *
 * The puzzle has no row in daily_puzzles, so it is never submitted, scored,
 * or rewarded, and it cannot be farmed. It costs no free play and touches no
 * server. It exists to teach three things before the player meets a real
 * puzzle: selecting a cell, toggling direction, and — the one nobody expects
 * — that some clues read backwards.
 *
 * Hints here are local and free. Routing them through spend_on_hint would
 * fail the foreign key, since the tutorial puzzle isn't a real one.
 */
export default function TutorialScreen() {
  const { activePuzzle, selectedCell, setActivePuzzle, revealLetter } =
    usePuzzleStore();

  // The framing beat that used to sit here is gone: the start screen now
  // says what the warm-up is, and saying it twice made the app feel like it
  // kept clearing its throat before letting anyone play.
  const [coachVisible, setCoachVisible] = useState(true);
  const [hasTouchedReverse, setHasTouchedReverse] = useState(false);
  const [solved, setSolved] = useState(false);
  const [linking, setLinking] = useState(false);

  /**
   * Whether an account is already linked. The start screen offers sign-in
   * first now, so most players arrive here having already decided — asking
   * again on the celebration screen would be nagging.
   */
  const [hasAccount, setHasAccount] = useState(false);
  useEffect(() => {
    void getLinkedProviders().then(({ hasGoogle, hasApple }) =>
      setHasAccount(hasGoogle || hasApple),
    );
  }, []);

  /**
   * The grid renders from puzzleStore, so the tutorial has to put its puzzle
   * there. Stash whatever was already in flight and put it back on the way
   * out — otherwise replaying the tutorial would silently destroy a real
   * puzzle the player had in progress.
   */
  const stashed = useRef<{ puzzle: typeof activePuzzle; timer: number } | null>(
    null,
  );

  useEffect(() => {
    const state = usePuzzleStore.getState();
    stashed.current = { puzzle: state.activePuzzle, timer: state.timer };

    setActivePuzzle(JSON.parse(JSON.stringify(TUTORIAL_PUZZLE)));

    return () => {
      const saved = stashed.current;
      if (saved?.puzzle) {
        usePuzzleStore.setState({
          activePuzzle: saved.puzzle,
          timer: saved.timer,
        });
      } else {
        usePuzzleStore.getState().clearActivePuzzle();
      }
    };
  }, []);

  /** Note when the player first lands on a backwards clue. */
  useEffect(() => {
    if (hasTouchedReverse || !activePuzzle || !selectedCell) return;
    const cell = activePuzzle.grid[selectedCell.row]?.[selectedCell.col];
    if (!cell) return;
    if (cell.clueIds.some((id) => TUTORIAL_REVERSE_CLUE_IDS.includes(id))) {
      setHasTouchedReverse(true);
    }
  }, [selectedCell?.row, selectedCell?.col, activePuzzle, hasTouchedReverse]);

  /** Completion — local only. Nothing is recorded anywhere. */
  useEffect(() => {
    if (solved || !activePuzzle) return;
    const cells = activePuzzle.grid.flat().filter((c) => !c.isBlocked);
    const done = cells.every((c) => c.userInput === c.letter);
    if (done) {
      setSolved(true);
      if (useSettingsStore.getState().hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      SFX.puzzleComplete();
      track("onboarding_completed", { via: "tutorial" });
    }
  }, [activePuzzle, solved]);

  const finish = () => {
    useSettingsStore.getState().setHasCompletedOnboarding(true);
    router.replace("/(tabs)");
  };

  const skip = () => {
    track("tutorial_skipped", { from: "tutorial" });
    useSettingsStore.getState().setHasCompletedOnboarding(true);
    router.replace("/(tabs)");
  };

  const handleLink = async () => {
    setLinking(true);
    await linkGoogleAccount();
    setLinking(false);
    finish();
  };

  if (!activePuzzle) return <View style={styles.container} />;

  // ── Celebration + sign-in offer ──────────────────────────────────
  if (solved) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.celebrate}>
          <Animated.View entering={FadeIn.duration(500)}>
            <MaterialIcons
              name="workspace-premium"
              size={64}
              color={theme.colors.accentGold}
            />
          </Animated.View>
          <Animated.Text
            entering={FadeInUp.delay(200).duration(500)}
            style={styles.celebrateTitle}
          >
            That&apos;s the warm-up.
          </Animated.Text>
          <Animated.Text
            entering={FadeInUp.delay(350).duration(500)}
            style={styles.celebrateBody}
          >
            Every answer was about crosswords. The real ones are less
            self-absorbed, and quite a lot harder.
            {"\n\n"}
            A fresh set lands every day at midnight. You have 300 coins to
            spend on hints when they do.
          </Animated.Text>

          <Animated.View
            entering={FadeInUp.delay(550).duration(500)}
            style={styles.celebrateActions}
          >
            {hasAccount ? (
              <Button title="Start playing" onPress={finish} />
            ) : (
              <>
                <Button
                  title={linking ? "Connecting…" : "Save my progress"}
                  onPress={handleLink}
                  disabled={linking}
                />
                <TouchableOpacity
                  onPress={finish}
                  style={styles.laterButton}
                  accessibilityRole="button"
                  accessibilityLabel="Continue without signing in"
                >
                  <Text style={styles.laterText}>Not now</Text>
                </TouchableOpacity>
                <Text style={styles.laterNote}>
                  You can link an account any time from your profile.
                </Text>
              </>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── The guided puzzle ────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>WARM-UP</Text>
          <TouchableOpacity
            onPress={skip}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Skip the tutorial"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {coachVisible && (
          <CoachBar
            puzzle={activePuzzle}
            selectedCell={selectedCell}
            hasTouchedReverse={hasTouchedReverse}
            onDismiss={() => setCoachVisible(false)}
          />
        )}

        <ActiveClueBar onHintPress={() => revealLetter()} />
        <CrosswordGrid />

        <View style={styles.bottomSection}>
          <CluePanel />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 11,
    letterSpacing: 3,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  skipText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  bottomSection: {
    flex: 1,
    minHeight: 160,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  celebrate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  celebrateTitle: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 34,
    color: theme.colors.textPrimary,
    marginTop: 24,
    textAlign: "center",
  },
  celebrateBody: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 320,
  },
  celebrateActions: { marginTop: 40, alignSelf: "stretch" },
  laterButton: { alignItems: "center", paddingVertical: 16 },
  laterText: {
    fontFamily: theme.typography.subheading.fontFamily,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  laterNote: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: "center",
  },
});

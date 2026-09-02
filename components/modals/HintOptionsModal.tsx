import { MaterialIcons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import React, { useEffect, useMemo, useState } from "react";
import { SFX } from "../../services/soundService";
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import {
  buildWordPreview,
  canAffordHint,
  canRevealLetter,
  canRevealWord,
  CHECK_ERRORS_COST,
  REVEAL_LETTER_COST,
} from "../../services/hintEngine";
import { loadHintPrices, spendOnHint } from "../../services/economyService";
import { track } from "../../services/analyticsService";
import { HintPrices } from "../../supabase/functions/_shared/economyTypes.ts";
import { usePuzzleStore } from "../../stores/puzzleStore";
import { useUserStore } from "../../stores/userStore";

/**
 * HintOptionsModal — Full-screen "Need a Nudge?" hint page.
 *
 * Replaces the old modal overlay with a full-screen dark view that gives
 * each element generous spacing. Shows word preview, coin balance,
 * three hint options with dynamic pricing, and a dismiss button.
 */

interface HintOptionsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HintOptionsModal({ visible, onClose }: HintOptionsModalProps) {
  const {
    activePuzzle,
    selectedCell,
    getActiveClue,
    revealLetter,
    revealWord,
    checkErrors,
    checksRemaining,
    decrementCheck,
  } = usePuzzleStore();

  const { profile } = useUserStore();
  const coins = profile.coins;

  const [busy, setBusy] = useState(false);

  // Display-only prices. The server derives what it actually charges from
  // the same config row, so a stale value here is cosmetic, not exploitable.
  const [prices, setPrices] = useState<HintPrices | null>(null);
  useEffect(() => {
    loadHintPrices().then(setPrices);
  }, []);

  const letterPrice = prices?.reveal_letter ?? REVEAL_LETTER_COST;
  // Flat, not per-letter. The old 30-per-letter pricing meant an 8-letter
  // answer cost 240 and a 12-letter one 360 - a wall nobody paid.
  const wordPrice = prices?.reveal_word_flat ?? 120;
  const checkPrice = prices?.check_errors ?? CHECK_ERRORS_COST;

  const activeClue = getActiveClue();

  /** Word preview — correct entries at exact positions, underscores elsewhere */
  const wordPreview = useMemo(() => {
    if (!activePuzzle || !activeClue) return [];
    return buildWordPreview(activePuzzle.grid, activeClue);
  }, [activePuzzle, activeClue]);

  /** Check errors: free while free checks remain, priced afterwards */
  const checkErrorsCost = checksRemaining > 0 ? 0 : checkPrice;

  // Availability
  const letterAvailable = activePuzzle
    ? canRevealLetter(activePuzzle, selectedCell)
    : false;
  const wordAvailable = activePuzzle
    ? canRevealWord(activePuzzle, activeClue)
    : false;

  // Affordability
  const canAffordLetter = canAffordHint(letterPrice, coins);
  const canAffordWord = canAffordHint(wordPrice, coins);
  const canAffordCheck =
    checkErrorsCost === 0 || canAffordHint(checkErrorsCost, coins);

  // Combined flags — `busy` blocks a double-tap firing two charges
  const letterEnabled = letterAvailable && canAffordLetter && !busy;
  const wordEnabled = wordAvailable && canAffordWord && !busy;
  const checkEnabled = canAffordCheck && !busy;

  // ─── Handlers ─────────────────────────────────────────────────
  //
  // Charge FIRST, then reveal. The previous order revealed the answer and
  // then attempted payment, so a declined charge still gave the hint away.

  /**
   * Charges for a hint server-side.
   *
   * `actionId` is generated per tap and used as the idempotency key, so a
   * retry after a flaky response is free rather than double-charged.
   */
  const charge = async (
    hintType: "reveal_letter" | "reveal_word" | "check_errors",
  ) => {
    if (!activePuzzle) throw new Error("no_puzzle");
    const result = await spendOnHint(
      activePuzzle.id,
      hintType,
      Crypto.randomUUID(),
    );
    useUserStore.getState().applyServerBalance(result.balance);
    track("hint_used", { hintType, cost: result.cost });
    return result;
  };

  const handleRevealLetter = async () => {
    if (!letterEnabled) return;
    setBusy(true);
    try {
      await charge("reveal_letter");
      revealLetter();
      SFX.hint();
      onClose();
    } catch (e: any) {
      Alert.alert("Hint unavailable", e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRevealWord = async () => {
    if (!wordEnabled) return;
    setBusy(true);
    try {
      await charge("reveal_word");
      revealWord();
      SFX.hint();
      onClose();
    } catch (e: any) {
      Alert.alert("Hint unavailable", e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckErrors = async () => {
    if (!checkEnabled) return;
    setBusy(true);
    try {
      await charge("check_errors");
      checkErrors();
      decrementCheck();
      SFX.error();
      onClose();
    } catch (e: any) {
      Alert.alert("Check unavailable", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with back arrow */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Close hints and return to the puzzle"
            >
              <MaterialIcons
                name="arrow-back"
                size={22}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Title section */}
          <View style={styles.titleSection}>
            <View style={styles.iconCircle}>
              <MaterialIcons
                name="emoji-objects"
                size={36}
                color={theme.colors.accentGold}
              />
            </View>
            <Text style={styles.title}>Need a Nudge?</Text>
            <Text style={styles.subtitle}>
              Spend your earned coins to reveal letters or words.
            </Text>
          </View>

          {/* Word Preview */}
          {activeClue && wordPreview.length > 0 && (
            <View style={styles.previewSection}>
              <View style={styles.previewRow}>
                {wordPreview.map((char, i) => (
                  <View
                    key={i}
                    style={[
                      styles.previewCell,
                      char !== "_" && styles.previewCellFilled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.previewLetter,
                        char !== "_" && styles.previewLetterFilled,
                      ]}
                    >
                      {char}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!activeClue && (
            <View style={styles.previewSection}>
              <Text style={styles.noWordText}>
                Select a cell to see hint options
              </Text>
            </View>
          )}

          {/* Coin Balance */}
          <View style={styles.coinRow}>
            <MaterialIcons
              name="monetization-on"
              size={22}
              color={theme.colors.accentGold}
            />
            <Text style={styles.coinText}>{coins}</Text>
          </View>

          {/* Hint Options */}
          <View style={styles.optionsList}>
            {/* Reveal Letter */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                !letterEnabled && styles.optionDisabled,
              ]}
              disabled={!letterEnabled}
              onPress={handleRevealLetter}
            accessibilityRole="button"
            accessibilityLabel={`Reveal one letter for ${letterPrice} coins`}
            accessibilityState={{ disabled: !letterEnabled, busy }}
              activeOpacity={0.7}
            >
              <View style={styles.optionLeft}>
                <View
                  style={[
                    styles.optionIcon,
                    !letterEnabled && styles.optionIconDisabled,
                  ]}
                >
                  <MaterialIcons
                    name="search"
                    size={24}
                    color={
                      letterEnabled
                        ? theme.colors.accentGold
                        : "rgba(255,255,255,0.15)"
                    }
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text
                    style={[
                      styles.optionTitle,
                      !letterEnabled && styles.optionTitleDisabled,
                    ]}
                  >
                    Reveal Letter
                  </Text>
                  <Text style={styles.optionDesc}>
                    {letterAvailable
                      ? "Fills in the currently selected square."
                      : !selectedCell
                        ? "Select a cell first."
                        : "Cell already correct."}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.priceBadge,
                  !letterEnabled && styles.priceBadgeDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.priceText,
                    !letterEnabled && styles.priceTextDisabled,
                  ]}
                >
                  {letterPrice}
                </Text>
                <MaterialIcons
                  name="monetization-on"
                  size={14}
                  color={
                    letterEnabled
                      ? theme.colors.accentGold
                      : "rgba(255,255,255,0.15)"
                  }
                />
              </View>
            </TouchableOpacity>

            {/* Reveal Word */}
            <TouchableOpacity
              style={[styles.optionCard, !wordEnabled && styles.optionDisabled]}
              disabled={!wordEnabled}
              onPress={handleRevealWord}
            accessibilityRole="button"
            accessibilityLabel={`Reveal the whole word for ${wordPrice} coins`}
            accessibilityState={{ disabled: !wordEnabled, busy }}
              activeOpacity={0.7}
            >
              <View style={styles.optionLeft}>
                <View
                  style={[
                    styles.optionIcon,
                    !wordEnabled && styles.optionIconDisabled,
                  ]}
                >
                  <MaterialIcons
                    name="text-format"
                    size={24}
                    color={
                      wordEnabled
                        ? theme.colors.accentGold
                        : "rgba(255,255,255,0.15)"
                    }
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text
                    style={[
                      styles.optionTitle,
                      !wordEnabled && styles.optionTitleDisabled,
                    ]}
                  >
                    Reveal Word
                  </Text>
                  <Text style={styles.optionDesc}>
                    {wordAvailable
                      ? "Solves the entire active word instantly."
                      : !activeClue
                        ? "Select a word first."
                        : "Word already complete."}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.priceBadge,
                  !wordEnabled && styles.priceBadgeDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.priceText,
                    !wordEnabled && styles.priceTextDisabled,
                  ]}
                >
                  {wordPrice}
                </Text>
                <MaterialIcons
                  name="monetization-on"
                  size={14}
                  color={
                    wordEnabled
                      ? theme.colors.accentGold
                      : "rgba(255,255,255,0.15)"
                  }
                />
              </View>
            </TouchableOpacity>

            {/* Check Errors */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                !checkEnabled && styles.optionDisabled,
              ]}
              disabled={!checkEnabled}
              onPress={handleCheckErrors}
            accessibilityRole="button"
            accessibilityLabel={
              checkErrorsCost === 0
                ? "Check for mistakes, free"
                : `Check for mistakes for ${checkErrorsCost} coins`
            }
            accessibilityState={{ disabled: !checkEnabled, busy }}
              activeOpacity={0.7}
            >
              <View style={styles.optionLeft}>
                <View
                  style={[
                    styles.optionIcon,
                    !checkEnabled && styles.optionIconDisabled,
                  ]}
                >
                  <MaterialIcons
                    name="fact-check"
                    size={24}
                    color={
                      checkEnabled
                        ? theme.colors.accentGold
                        : "rgba(255,255,255,0.15)"
                    }
                  />
                </View>
                <View style={styles.optionInfo}>
                  <Text
                    style={[
                      styles.optionTitle,
                      !checkEnabled && styles.optionTitleDisabled,
                    ]}
                  >
                    Check Errors
                  </Text>
                  <Text style={styles.optionDesc}>
                    Highlights incorrect letters in red.
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.priceBadge,
                  checkErrorsCost === 0
                    ? styles.priceBadgeFree
                    : !checkEnabled
                      ? styles.priceBadgeDisabled
                      : undefined,
                ]}
              >
                {checkErrorsCost === 0 ? (
                  <Text style={styles.priceTextFree}>
                    FREE ({checksRemaining})
                  </Text>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.priceText,
                        !checkEnabled && styles.priceTextDisabled,
                      ]}
                    >
                      {checkPrice}
                    </Text>
                    <MaterialIcons
                      name="monetization-on"
                      size={14}
                      color={
                        checkEnabled
                          ? theme.colors.accentGold
                          : "rgba(255,255,255,0.15)"
                      }
                    />
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Dismiss — fixed at bottom */}
        <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
          <Text style={styles.dismissText}>NO THANKS, I'LL KEEP TRYING</Text>
        </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Title
  titleSection: {
    alignItems: "center",
    marginBottom: 40,
    marginTop: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    lineHeight: 22,
  },

  // Word Preview
  previewSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  previewCell: {
    width: 36,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewCellFilled: {
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    borderColor: "rgba(238, 205, 43, 0.25)",
  },
  previewLetter: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 18,
    color: "rgba(255,255,255,0.25)",
    fontWeight: "bold",
  },
  previewLetterFilled: {
    color: theme.colors.accentGold,
  },
  noWordText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    paddingVertical: 12,
  },

  // Coin Balance
  coinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 36,
  },
  coinText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
  },

  // Hint Options
  optionsList: {
    gap: 14,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  optionDisabled: {
    opacity: 0.35,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(238, 205, 43, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionIconDisabled: {
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 4,
  },
  optionTitleDisabled: {
    color: "rgba(255,255,255,0.25)",
  },
  optionDesc: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    lineHeight: 16,
  },

  // Price Badges
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(238, 205, 43, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(238, 205, 43, 0.2)",
  },
  priceBadgeDisabled: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.04)",
  },
  priceBadgeFree: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.15)",
  },
  priceText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 15,
    color: theme.colors.accentGold,
    fontWeight: "bold",
  },
  priceTextDisabled: {
    color: "rgba(255,255,255,0.15)",
  },
  priceTextFree: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 13,
    color: "#22c55e",
    fontWeight: "bold",
  },

  // Dismiss
  dismissBtn: {
    paddingVertical: 20,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  dismissText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "bold",
    letterSpacing: 1.5,
  },
});

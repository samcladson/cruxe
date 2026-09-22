import React from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { useReducedMotion } from "../../utils/useReducedMotion";
import { CompletionActions } from "./CompletionActions";
import { ScreenBackdrop } from "../ui/ScreenBackdrop";

/** One fact, tied to the clue the player solved to earn it. */
export interface LessonFact {
  /** e.g. "1 ACROSS", "2 BACKWARDS" — already formatted. */
  reference: string;
  word: string;
  fact: string;
  /**
   * True when the player got this word wrong and has not bought it back.
   *
   * The fact is still present in this object: the lesson ships inside the
   * puzzle payload, so the lock is what the screen draws, not what it knows.
   * The spend behind it is real and server-checked.
   */
  locked: boolean;
}

interface LessonScreenProps {
  /** The puzzle's subject. */
  title: string;
  takeaway?: string;
  facts: ReadonlyArray<LessonFact>;
  /** Coins one locked fact costs, priced by the puzzle's difficulty. */
  unlockPrice: number;
  /** Resolves true once the fact has been paid for. */
  onUnlock: (word: string) => Promise<boolean>;
  /** Normally true — the takeaway ends the flow when a puzzle has one. */
  isLast: boolean;
  onContinue: () => void;
  onPickAnother: () => void;
  onHome: () => void;
}

/** Each block enters a beat after the one above it. */
const STEP_MS = 90;
const FACTS_START_MS = 300;
/** Facts past the fifth arrive together, so the button never waits on a long list. */
const MAX_STAGGERED_FACTS = 5;

/**
 * What the player just learned, shown before the score.
 *
 * Deliberately unornamented: no cards, no rules, no accent bars. Hierarchy is
 * carried by type size, weight and colour, and the only structure imposed on
 * the facts is the clue reference each one already has — which comes from the
 * puzzle rather than being decoration laid over it.
 *
 * This used to sit beneath the stats on the completion screen, where a
 * `flex: 1` stats block and a `maxHeight: 260` lesson block competed for one
 * screen, and the stats overflowed and drew over the facts.
 */
export function LessonScreen({
  title,
  takeaway,
  facts,
  unlockPrice,
  onUnlock,
  isLast,
  onContinue,
  onPickAnother,
  onHome,
}: LessonScreenProps) {
  const reduceMotion = useReducedMotion();
  /** The word currently being bought, so only its own tag spins. */
  const [unlocking, setUnlocking] = React.useState<string | null>(null);

  const unlock = async (word: string) => {
    setUnlocking(word);
    try {
      await onUnlock(word);
    } catch (e: any) {
      Alert.alert("Couldn't unlock", e?.message ?? "Please try again.");
    } finally {
      setUnlocking(null);
    }
  };

  /** Entrance for the nth block, or nothing at all under reduced motion. */
  const rise = (delay: number) =>
    reduceMotion ? undefined : FadeInUp.delay(delay).duration(380);

  const buttonDelay =
    FACTS_START_MS +
    Math.min(facts.length, MAX_STAGGERED_FACTS) * STEP_MS +
    120;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenBackdrop variant="success" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text entering={rise(0)} style={styles.eyebrow}>
          TAKEAWAY
        </Animated.Text>

        <Animated.Text entering={rise(STEP_MS)} style={styles.title}>
          {title}
        </Animated.Text>

        {takeaway ? (
          // The entrance animates a wrapper, and the paragraph is a plain Text.
          // The paragraph's last line ("PLAY." on a line of its own) was being
          // cut off on Android although the stored takeaway was complete.
          // Animating the Text itself with justified alignment is the suspect:
          // both are gone here (the alignment never rendered justified anyway).
          // Confirm on a device that the paragraph now ends in full.
          <Animated.View entering={rise(STEP_MS * 2)}>
            <Text style={styles.takeaway}>{takeaway}</Text>
          </Animated.View>
        ) : null}

        {facts.map(({ reference, word, fact, locked }, i) => (
          <Animated.View
            key={`${reference}-${word}`}
            entering={rise(
              FACTS_START_MS + Math.min(i, MAX_STAGGERED_FACTS) * STEP_MS,
            )}
            style={styles.factRow}
          >
            <Text style={styles.factLabel}>
              <Text style={styles.factReference}>{reference}</Text>
              <Text style={styles.factSeparator}>{"  ·  "}</Text>
              <Text style={locked ? styles.factWordLocked : styles.factWord}>
                {locked ? "?????" : word}
              </Text>
            </Text>

            {locked ? (
              <TouchableOpacity
                style={styles.lockedWrap}
                onPress={() => unlock(word)}
                disabled={unlocking !== null}
                accessibilityRole="button"
                accessibilityLabel={`Unlock what ${reference} was, for ${unlockPrice} coins`}
              >
                {/* The text underneath is never rendered: a blurred view can
                    still be read by a screenshot, and there is no reason to
                    draw something the player has not paid for. */}
                <Text style={styles.lockedRedacted} numberOfLines={2}>
                  {"█".repeat(28)}
                </Text>
                <View style={styles.priceTag}>
                  {unlocking === word ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <MaterialIcons
                        name="monetization-on"
                        size={15}
                        color="#000"
                      />
                      <Text style={styles.priceText}>{unlockPrice}</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ) : (
              <Text style={styles.factText}>{fact}</Text>
            )}
          </Animated.View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {/* Content fades out under the buttons instead of being cut off by
            an opaque bar appearing mid-sentence as you scroll. */}
        <LinearGradient
          colors={["rgba(10,10,10,0)", theme.colors.bgPrimary]}
          style={styles.footerFade}
          pointerEvents="none"
        />
        <Animated.View entering={rise(buttonDelay)} style={styles.bottomActions}>
          <CompletionActions
            isLast={isLast}
            onContinue={onContinue}
            onPickAnother={onPickAnother}
            onHome={onHome}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 32,
  },
  eyebrow: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: "bold",
    color: theme.colors.accentGold,
    marginBottom: 12,
  },
  title: {
    fontFamily: theme.typography.heading.fontFamily,
    fontSize: 27,
    lineHeight: 34,
    color: theme.colors.textPrimary,
    marginBottom: 18,
  },
  takeaway: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 25,
    color: theme.colors.textSecondary,
    // The gap before the first fact is what separates the two halves of this
    // screen, in place of a rule or a container.
    marginBottom: 44,
  },
  factRow: {
    marginBottom: 26,
  },
  factLabel: {
    marginBottom: 5,
  },
  factReference: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "bold",
    color: theme.colors.textMuted,
  },
  factSeparator: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  factWord: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "bold",
    color: theme.colors.accentGold,
  },
  factWordLocked: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "bold",
    color: theme.colors.textMuted,
  },
  // The redaction and the price sit on one line: the row stays the same
  // height locked or unlocked, so buying one does not reflow the list.
  lockedWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lockedRedacted: {
    flex: 1,
    fontSize: 12,
    lineHeight: 21,
    color: "rgba(255,255,255,0.07)",
  },
  priceTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.accentGold,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 100,
    minWidth: 62,
    justifyContent: "center",
  },
  priceText: {
    fontFamily: theme.typography.cellLetter.fontFamily,
    fontSize: 13,
    fontWeight: "bold",
    color: "#000",
  },
  factText: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 13.5,
    lineHeight: 21,
    color: theme.colors.textSecondary,
  },
  footer: {
    position: "relative",
  },
  footerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -28,
    height: 28,
  },
  // Padding belongs to CompletionActions; this only keeps the buttons opaque
  // over content scrolling beneath them.
  bottomActions: {
    backgroundColor: theme.colors.bgPrimary,
  },
});

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";
import { useReducedMotion } from "../../utils/useReducedMotion";
import { CompletionActions } from "./CompletionActions";

/** One fact, tied to the clue the player solved to earn it. */
export interface LessonFact {
  /** e.g. "1 ACROSS", "2 BACKWARDS" — already formatted. */
  reference: string;
  word: string;
  fact: string;
}

interface LessonScreenProps {
  /** The puzzle's subject. */
  title: string;
  takeaway?: string;
  facts: ReadonlyArray<LessonFact>;
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
  isLast,
  onContinue,
  onPickAnother,
  onHome,
}: LessonScreenProps) {
  const reduceMotion = useReducedMotion();

  /** Entrance for the nth block, or nothing at all under reduced motion. */
  const rise = (delay: number) =>
    reduceMotion ? undefined : FadeInUp.delay(delay).duration(380);

  const buttonDelay =
    FACTS_START_MS +
    Math.min(facts.length, MAX_STAGGERED_FACTS) * STEP_MS +
    120;

  return (
    <SafeAreaView style={styles.screen}>
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
          <Animated.Text
            entering={rise(STEP_MS * 2)}
            style={styles.takeaway}
            // Android only justifies when the break strategy allows it, and
            // ignores textAlign: "justify" otherwise. Harmless on iOS.
            textBreakStrategy="highQuality"
          >
            {takeaway}
          </Animated.Text>
        ) : null}

        {facts.map(({ reference, word, fact }, i) => (
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
              <Text style={styles.factWord}>{word}</Text>
            </Text>
            <Text style={styles.factText}>{fact}</Text>
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
    textAlign: "justify",
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

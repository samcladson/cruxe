import { router } from "expo-router";
import React, { useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, { SlideInRight, SlideOutLeft } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../components/ui/Button";
import { theme } from "../../constants/theme";
import { useSettingsStore } from "../../stores/settingsStore";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    title: "The Elite\nCrossword",
    subtitle:
      "Meticulously crafted puzzles powered by advanced AI, designed for the discerning mind.",
  },
  {
    title: "Precision\nCrafted",
    subtitle:
      "From the spacing of the grid to the elegance of the typographic clues, every detail matters.",
  },
  {
    title: "Expand\nYour Mind",
    subtitle:
      "Explore subjects from History to Technology in our beautifully curated daily categories.",
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      useSettingsStore.getState().setHasCompletedOnboarding(true);
      router.replace("/(auth)/sign-in");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          key={currentIndex}
          entering={SlideInRight.duration(400).springify()}
          exiting={SlideOutLeft.duration(300)}
          style={styles.slide}
        >
          <Text style={styles.title}>{SLIDES[currentIndex].title}</Text>
          <Text style={styles.subtitle}>{SLIDES[currentIndex].subtitle}</Text>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
          <Button
            title={currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"}
            onPress={handleNext}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    padding: 32,
    paddingTop: 80,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontFamily: theme.typography.display.fontFamily,
    fontSize: 48,
    color: theme.colors.textPrimary,
    lineHeight: 56,
    marginBottom: 24,
  },
  subtitle: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 18,
    color: theme.colors.textSecondary,
    lineHeight: 28,
  },
  footer: {
    paddingBottom: 32,
  },
  pagination: {
    flexDirection: "row",
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.bgTertiary,
  },
  dotActive: {
    backgroundColor: theme.colors.accentGold,
    width: 24,
  },
});

import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/components/useColorScheme";
import { usePuzzleStore } from "@/stores/puzzleStore";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { activePuzzle, clearActivePuzzle } = usePuzzleStore();

  /**
   * Retention Policy: Auto-discard stale in-progress puzzles.
   * If a puzzle was started more than 7 days ago, clear it to keep storage lean.
   */
  useEffect(() => {
    if (!activePuzzle) return;

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const startTime =
      activePuzzle.startedAt || new Date(activePuzzle.date).getTime();
    const now = Date.now();

    if (now - startTime > SEVEN_DAYS_MS) {
      console.log("[Retention] Discarding stale active puzzle (>7 days old)");
      clearActivePuzzle();
    }
  }, [activePuzzle, clearActivePuzzle]);

  /** Custom dark theme that matches Cruxe's bgPrimary and accentGold */
  const CruxeTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: "#0a0a0a",
      card: "#0d0d0d",
      text: "#f8f8f6",
      border: "rgba(255,255,255,0.06)",
      primary: "#eecd2b",
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={CruxeTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="game/generate"
            options={{ headerShown: false, animation: "fade" }}
          />
          <Stack.Screen
            name="game/[puzzleId]"
            options={{ headerShown: false }}
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

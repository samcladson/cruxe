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
import { AppState, AppStateStatus } from "react-native";
import { ensureUserProfile, initAuth, onAuthStateChange } from "../services/authService";
import { drainPendingCompletions } from "../services/offlineSyncService";
import { initRevenueCat, loginToRevenueCat } from "../services/revenueCatService";
import { preloadSounds } from "../services/soundService";
import { useUserStore } from "../stores/userStore";

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
  const { setUserId, syncFromSupabase } = useUserStore();

  /**
   * Bootstrap authentication on app mount.
   *
   * 1. Restore existing session (AsyncStorage) or create new anonymous one.
   * 2. Write the real UUID into the local userStore (replaces "guest").
   * 3. Ensure the `users` row exists in the DB (no-op if already present).
   * 4. Hydrate local stats, coins, streak from Supabase (remote wins on conflict).
   *
   * If Supabase is unreachable the app continues in degraded local-only mode.
   */
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const bootstrap = async () => {
      preloadSounds(); // Fire-and-forget — non-blocking
      await initRevenueCat();

      const authState = await initAuth();
      const userId = authState.user?.id;

      if (userId) {
        setUserId(userId);
        await loginToRevenueCat(userId);
        await ensureUserProfile(userId);
        await syncFromSupabase(userId);
        console.log("[Layout] Auth bootstrap complete for user:", userId);
      } else {
        console.warn("[Layout] Auth unavailable — running in local-only mode");
      }

      // Stay subscribed to token refreshes and future sign-in upgrades
      unsubscribe = onAuthStateChange(async (user) => {
        if (user?.id && user.id !== useUserStore.getState().profile.id) {
          setUserId(user.id);
          await loginToRevenueCat(user.id);
          await syncFromSupabase(user.id);
        }
      });
    };

    bootstrap();
    return () => unsubscribe?.();
  }, []);

  /**
   * Drain offline completion queue whenever the app returns to the foreground.
   * Queued completions are retried silently — the user sees nothing unless
   * there's a persistent failure after many retries.
   */
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        drainPendingCompletions().catch((err) =>
          console.warn("[Layout] Offline drain error:", err),
        );
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  /**
   * Retention Policy: Auto-discard stale in-progress puzzles.
   * If a puzzle was started more than 7 days ago, clear it to keep storage lean.
   */
  useEffect(() => {
    if (!activePuzzle) return;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const startTime =
      activePuzzle.startedAt || new Date(activePuzzle.date).getTime();
    if (Date.now() - startTime > SEVEN_DAYS_MS) {
      console.log("[Retention] Discarding stale active puzzle (>7 days old)");
      clearActivePuzzle();
    }
  }, [activePuzzle, clearActivePuzzle]);

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
            name="collection/index"
            options={{
              headerShown: true,
              headerTitle: "Today's Collection",
              headerStyle: { backgroundColor: "#1a1810" },
              headerTintColor: "#fff",
              headerTitleStyle: { fontFamily: "Manrope_600SemiBold" },
              headerBackTitle: "Home",
            }}
          />
          <Stack.Screen
            name="category/[id]"
            options={{
              headerShown: true,
              headerTitle: "",
              headerTransparent: true,
              headerTintColor: "#fff",
              headerBackTitle: "Home",
            }}
          />
          <Stack.Screen
            name="legal/privacy"
            options={{
              headerShown: false,
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="legal/terms"
            options={{
              headerShown: false,
              presentation: "modal",
            }}
          />
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

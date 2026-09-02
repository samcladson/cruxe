import * as Sentry from "@sentry/react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import {
  ErrorBoundary as RouterErrorBoundary,
  ErrorBoundaryProps,
  Stack,
  useNavigationContainerRef,
} from "expo-router";
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
import { initAuth, onAuthStateChange } from "../services/authService";
import { reportError } from "../services/errorReporting";
import { drainPendingSolves } from "../services/offlineSyncService";
import { initRevenueCat, loginToRevenueCat } from "../services/revenueCatService";
import { preloadSounds } from "../services/soundService";
import { useUserStore } from "../stores/userStore";

/**
 * Catch any errors thrown while rendering a route.
 *
 * expo-router's own ErrorBoundary renders a fallback and reports nothing, so
 * a render crash would show "Something went wrong" and never leave the device.
 * Report first, then hand off to the stock screen for the retry affordance.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => {
    reportError("render", props.error);
  }, [props.error]);

  return <RouterErrorBoundary {...props} />;
}

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Records screen transitions as breadcrumbs and navigation transactions.
// Without this, `tracesSampleRate` below only ever produces app-start spans
// and a crash arrives with no trail of where the player had been.
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

// Crash reporting. Disabled in development so local stack traces stay local
// and the issue stream reflects real users only.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__ && Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  integrations: [navigationIntegration],
  tracesSampleRate: 0.2,
  // Puzzle content and auth tokens must never leave the device. The device
  // name is dropped because users often put their real name in it.
  beforeSend(event) {
    if (event.contexts?.device) delete event.contexts.device.name;
    return event;
  },
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayout() {
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

  // Hand the router's container to Sentry once it exists, so screen changes
  // start showing up as breadcrumbs on every subsequent report.
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationRef?.current) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

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
        // Anonymous UUID only — enough to correlate a user's crashes,
        // nothing that identifies a person.
        Sentry.setUser({ id: userId });
        await loginToRevenueCat(userId);
        await syncFromSupabase(userId);
        console.log("[Layout] Auth bootstrap complete for user:", userId);
      } else {
        console.warn("[Layout] Auth unavailable — running in local-only mode");
      }

      // Stay subscribed to token refreshes and future sign-in upgrades
      // Defer async work: Supabase auth holds a lock during this callback; awaiting
      // other auth calls here can deadlock.
      unsubscribe = onAuthStateChange((user) => {
        if (user?.id && user.id !== useUserStore.getState().profile.id) {
          const uid = user.id;
          setTimeout(() => {
            setUserId(uid);
            void (async () => {
              await loginToRevenueCat(uid);
              await useUserStore.getState().syncFromSupabase(uid);
            })();
          }, 0);
        }
      });
    };

    // An unhandled rejection here would leave the app in local-only mode with
    // no trace of why, so the whole bootstrap reports rather than vanishing.
    bootstrap().catch((err) => reportError("auth", err));
    return () => unsubscribe?.();
  }, []);

  /**
   * Drain the offline solve queue whenever the app returns to the foreground.
   * Queued solves are retried silently — the user sees nothing unless
   * there's a persistent failure after many retries.
   */
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        drainPendingSolves().catch((err) => {
          console.warn("[Layout] Offline drain error:", err);
          // A solve that never drains is a player whose progress silently
          // vanished — the one sync failure always worth an issue.
          reportError("sync", err);
        });
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

// Wrapped so Sentry can capture render errors and navigation breadcrumbs.
export default Sentry.wrap(RootLayout);

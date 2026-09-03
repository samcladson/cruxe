import { Stack } from "expo-router";

/**
 * Onboarding stack: the start screen, then the warm-up.
 *
 * `welcome` is both the first-run screen and the sign-in screen. Merging them
 * removed a third screen (`sign-in`) that framed the app differently from the
 * other two. This previously declared a screen named `onboarding` that has no
 * file, and omitted both screens that do exist.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="tutorial" />
    </Stack>
  );
}

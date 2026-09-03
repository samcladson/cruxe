import { Stack } from "expo-router";

/**
 * Activity lives inside the tab navigator so the bottom bar stays visible on
 * both screens, and nests a stack of its own so the list and a single
 * puzzle's insights push and pop properly rather than replacing each other.
 */
export default function ActivityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}

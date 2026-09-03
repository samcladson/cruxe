/**
 * onboardingRoute.ts — Where the start screen sends you.
 *
 * The start screen is reached by two different people: a first-time player,
 * and someone who has just signed out and is coming back. One screen, two
 * destinations, decided by a single flag.
 */

export type StartDestination = "/(auth)/tutorial" | "/(tabs)";

export function routeAfterStart(
  hasCompletedOnboarding: boolean,
): StartDestination {
  return hasCompletedOnboarding ? "/(tabs)" : "/(auth)/tutorial";
}

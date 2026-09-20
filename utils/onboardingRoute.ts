/**
 * onboardingRoute.ts — Where the start screen sends you.
 *
 * The start screen is reached by two different people: a first-time player,
 * and someone who has just signed out and is coming back. One screen, two
 * destinations, decided by a single flag.
 */

export type StartDestination = "/(auth)/tutorial" | "/(tabs)";
export type LaunchDestination = "/(auth)/welcome" | StartDestination;

export function routeAfterStart(
  hasCompletedOnboarding: boolean,
): StartDestination {
  return hasCompletedOnboarding ? "/(tabs)" : "/(auth)/tutorial";
}

/**
 * Where a launch goes, now that an account is required.
 *
 * Anonymous sign-in used to guarantee every launch had a session, so this
 * decision did not exist — the app could always go straight in. With guest
 * play removed, no session means no entry, and onboarding completed on some
 * earlier account does not change that.
 */
export function routeForSession(
  hasSession: boolean,
  hasCompletedOnboarding: boolean,
): LaunchDestination {
  if (!hasSession) return "/(auth)/welcome";
  return routeAfterStart(hasCompletedOnboarding);
}

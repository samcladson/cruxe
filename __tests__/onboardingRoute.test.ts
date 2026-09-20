import {
  routeAfterStart,
  routeForSession,
} from "../utils/onboardingRoute";

/**
 * The start screen serves two different people: someone opening the app for
 * the first time, and someone who has just signed out and needs to get back
 * in. Merging the old welcome and sign-in screens into one is only correct
 * if it sends those two to different places.
 */
describe("routeAfterStart", () => {
  it("sends a first-time player to the warm-up", () => {
    expect(routeAfterStart(false)).toBe("/(auth)/tutorial");
  });

  it("sends a returning player straight into the app", () => {
    // Signing out deliberately leaves onboarding complete — it is not the
    // same as starting over, and replaying the tutorial would be a punishment
    // for signing out.
    expect(routeAfterStart(true)).toBe("/(tabs)");
  });
});

/**
 * Where the app opens once an account is required.
 *
 * Anonymous sign-in is gone, so a launch with no session has nowhere to go
 * but the sign-in screen. Previously every launch had a session — the app
 * created one silently — and this decision did not exist.
 */
describe("routeForSession", () => {
  it("sends a launch with no session to sign in", () => {
    expect(routeForSession(false, false)).toBe("/(auth)/welcome");
  });

  it("still sends a signed-out launch to sign in even if onboarded", () => {
    // Onboarding completed on a previous account does not grant entry.
    expect(routeForSession(false, true)).toBe("/(auth)/welcome");
  });

  it("sends a signed-in first-timer to the warm-up", () => {
    expect(routeForSession(true, false)).toBe("/(auth)/tutorial");
  });

  it("sends a signed-in returning player into the app", () => {
    expect(routeForSession(true, true)).toBe("/(tabs)");
  });
});

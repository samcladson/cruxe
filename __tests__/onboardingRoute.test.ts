import { routeAfterStart } from "../utils/onboardingRoute";

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

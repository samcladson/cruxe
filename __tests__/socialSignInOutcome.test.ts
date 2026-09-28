import { socialSignInOutcome } from "../utils/socialSignIn";

/**
 * The bug these cover: cancelling Google's (or Apple's) sheet returned
 * `{ error: null }`, which the welcome screen read as success. It then sent
 * the player into the app with no session at all — no coins, no account —
 * a leftover from when an anonymous session made continuing harmless.
 */
describe("socialSignInOutcome", () => {
  it("treats a cancelled sheet as cancelled, not as signed in", () => {
    expect(socialSignInOutcome({ error: null, cancelled: true })).toBe(
      "cancelled",
    );
  });

  it("treats an error as failed", () => {
    expect(socialSignInOutcome({ error: new Error("nope") })).toBe("failed");
  });

  it("an error wins even if a cancelled flag is somehow also set", () => {
    expect(
      socialSignInOutcome({ error: new Error("x"), cancelled: true }),
    ).toBe("failed");
  });

  it("treats a result with no error and no cancel as signed in", () => {
    expect(socialSignInOutcome({ error: null, user: { id: "u" } })).toBe(
      "signed-in",
    );
    expect(socialSignInOutcome({ error: null })).toBe("signed-in");
  });
});

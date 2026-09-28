import { safeIncomingPath } from "../utils/deepLink";

/**
 * Opening a puzzle charges a free play or coins the moment it loads. In the app
 * the price is on the button that starts it; a link from outside skips that, so
 * an incoming link must never land directly on a game route.
 */
describe("safeIncomingPath", () => {
  it.each([
    "cruxe://game/generate?id=abc",
    "cruxe:///game/generate?id=abc",
    "/game/generate?id=abc",
    "game/generate",
    "/game/5f1c-uuid",
    "cruxe://GAME/generate",
    "exp://192.168.1.2:8081/--/game/generate?id=abc",
  ])("sends %s home", (path) => {
    expect(safeIncomingPath(path)).toBe("/");
  });

  it.each([
    "/",
    "cruxe://",
    "/activity/123",
    "cruxe://leaderboard",
    "/legal/privacy",
    "/gamer-profile",
  ])("leaves %s alone", (path) => {
    expect(safeIncomingPath(path)).toBe(path);
  });
});

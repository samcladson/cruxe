import { keyboardOverlap } from "../utils/keyboardOverlap";

/**
 * How far the keyboard reaches up over the app's content, measured from the
 * bottom of the screen. The earlier version subtracted the keyboard's screen
 * position from a measureInWindow position, and on Android edge-to-edge those
 * differ by the status bar (38.6dp on a OnePlus), so the Done bar sat behind
 * the keyboard and the grid under-slid. Figures below are from that device.
 */
describe("keyboardOverlap", () => {
  const onePlus = { screenHeight: 754.29, bottomInset: 16 };

  it("is the keyboard's height above the bottom safe area", () => {
    // Keyboard top reported at 463.71dp on a 754.29dp-tall screen.
    expect(keyboardOverlap({ ...onePlus, keyboardScreenY: 463.71 })).toBeCloseTo(274.58, 1);
  });

  it("is zero when the keyboard is hidden", () => {
    expect(keyboardOverlap({ ...onePlus, keyboardScreenY: Infinity })).toBe(0);
  });

  it("never goes negative", () => {
    expect(keyboardOverlap({ ...onePlus, keyboardScreenY: 750 })).toBe(0);
  });

  it("works the same on an iPhone with a home indicator", () => {
    // 844pt screen, keyboard top at 508pt, 34pt home-indicator inset.
    expect(
      keyboardOverlap({ screenHeight: 844, bottomInset: 34, keyboardScreenY: 508 }),
    ).toBe(302);
  });
});

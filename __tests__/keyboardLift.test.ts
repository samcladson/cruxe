import { keyboardLift } from "../utils/keyboardLift";

/**
 * How far a bottom-pinned form must rise to clear the keyboard. Everything is
 * in window/screen coordinates, as `useKeyboardTop` reports them.
 */
describe("keyboardLift", () => {
  it("is zero while the keyboard is hidden", () => {
    expect(keyboardLift(800, Infinity)).toBe(0);
  });

  it("lifts the form's bottom to sit a gap above the keyboard", () => {
    // Form ends at 800, keyboard top at 500: rise 300, plus the 16 gap.
    expect(keyboardLift(800, 500)).toBe(316);
    expect(keyboardLift(800, 500, 24)).toBe(324);
  });

  it("does not move a form the keyboard does not reach", () => {
    expect(keyboardLift(400, 500)).toBe(0);
    expect(keyboardLift(490, 500)).toBe(6); // inside the gap: nudged only
  });

  it("ignores a form that has not been measured yet", () => {
    expect(keyboardLift(0, 500)).toBe(0);
  });
});

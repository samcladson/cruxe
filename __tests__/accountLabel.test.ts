import { accountLabel } from "../utils/accountLabel";

/**
 * The line under "Signed in" in Profile. It was blank for Apple accounts:
 * when Apple shares no email the auth API returns `""`, and `??` does not
 * treat an empty string as missing.
 */
describe("accountLabel", () => {
  it("shows the email when there is one", () => {
    expect(
      accountLabel({ email: "a@b.com", hasApple: false, hasGoogle: true }),
    ).toBe("a@b.com");
  });

  it("names Apple when Apple shared no email, as an empty string", () => {
    expect(accountLabel({ email: "", hasApple: true, hasGoogle: false })).toBe(
      "Apple account",
    );
  });

  it("names Apple when the email is null or blank", () => {
    expect(accountLabel({ email: null, hasApple: true, hasGoogle: false })).toBe(
      "Apple account",
    );
    expect(accountLabel({ email: "  ", hasApple: true, hasGoogle: false })).toBe(
      "Apple account",
    );
  });

  it("names Google, then falls back to a generic account", () => {
    expect(accountLabel({ email: "", hasApple: false, hasGoogle: true })).toBe(
      "Google account",
    );
    expect(accountLabel({ email: "", hasApple: false, hasGoogle: false })).toBe(
      "Cruxe account",
    );
  });
});

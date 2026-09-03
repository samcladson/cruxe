import {
  pickProviderName,
  sanitiseDisplayName,
} from "../utils/displayName";

/**
 * The RPC rejects anything outside 2-20 chars of [A-Za-z0-9 _'-], and a
 * rejection there means the player silently stays "Player" — so these cases
 * are the contract between the provider's name and what the server accepts.
 */
const RPC_CHARSET = /^[A-Za-z0-9 _'-]+$/;

describe("sanitiseDisplayName", () => {
  it("passes an ordinary name through untouched", () => {
    expect(sanitiseDisplayName("Sam Cladson")).toBe("Sam Cladson");
  });

  it("keeps the punctuation the RPC allows", () => {
    expect(sanitiseDisplayName("O'Brien-Smith_1")).toBe("O'Brien-Smith_1");
  });

  it("folds accents instead of dropping the letters", () => {
    expect(sanitiseDisplayName("José Ibáñez")).toBe("Jose Ibanez");
  });

  it("replaces characters outside the charset and collapses the gaps", () => {
    expect(sanitiseDisplayName("Anne-Marie (她) Doe")).toBe("Anne-Marie Doe");
    expect(sanitiseDisplayName("Dr. Who")).toBe("Dr Who");
  });

  it("falls back to the first word rather than truncating mid-word", () => {
    expect(sanitiseDisplayName("Bartholomew Cadwallader")).toBe("Bartholomew");
  });

  it("truncates a single over-long word to the RPC's limit", () => {
    const name = sanitiseDisplayName("Aaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(name).toHaveLength(20);
  });

  it("returns null when nothing usable survives", () => {
    expect(sanitiseDisplayName("")).toBeNull();
    expect(sanitiseDisplayName(null)).toBeNull();
    expect(sanitiseDisplayName(undefined)).toBeNull();
    expect(sanitiseDisplayName("上田")).toBeNull();
    expect(sanitiseDisplayName("X")).toBeNull();
    expect(sanitiseDisplayName("   ")).toBeNull();
  });

  it("never produces a value the RPC would reject", () => {
    const inputs = [
      "Sam Cladson",
      "José Ibáñez",
      "Anne-Marie (她) Doe",
      "Bartholomew Cadwallader",
      "  padded  name  ",
      "emoji 🎉 name",
    ];
    for (const input of inputs) {
      const out = sanitiseDisplayName(input);
      if (out === null) continue;
      expect(out).toMatch(RPC_CHARSET);
      expect(out.length).toBeGreaterThanOrEqual(2);
      expect(out.length).toBeLessThanOrEqual(20);
      expect(out).toBe(out.trim());
    }
  });
});

describe("pickProviderName", () => {
  it("prefers the full name", () => {
    expect(pickProviderName({ full: "Sam Cladson", given: "Sam" })).toBe(
      "Sam Cladson",
    );
  });

  it("falls back to the given name when the full one is unusable", () => {
    expect(pickProviderName({ full: "上田", given: "Sam" })).toBe("Sam");
    expect(pickProviderName({ full: null, given: "Sam" })).toBe("Sam");
  });

  it("returns null when the provider gave us nothing", () => {
    expect(pickProviderName({})).toBeNull();
    expect(pickProviderName({ full: "", given: "" })).toBeNull();
  });
});

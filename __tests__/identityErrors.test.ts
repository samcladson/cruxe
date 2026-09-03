import { isIdentityAlreadyLinked } from "../utils/identityErrors";

/**
 * The branch the whole returning-player fix hinges on. Sign-out leaves the
 * previous account intact holding the provider identity, so linking it to the
 * new anonymous account is rejected — and that rejection is the cue to sign
 * into the existing account instead.
 */
describe("isIdentityAlreadyLinked", () => {
  it("recognises the error code Supabase returns", () => {
    expect(
      isIdentityAlreadyLinked({ code: "identity_already_exists" }),
    ).toBe(true);
  });

  it("recognises the message, for versions that omit the code", () => {
    expect(
      isIdentityAlreadyLinked({
        message: "Identity is already linked to another user",
      }),
    ).toBe(true);
    // Casing must not matter.
    expect(
      isIdentityAlreadyLinked({ message: "identity is already linked" }),
    ).toBe(true);
  });

  it("does not fire on unrelated auth failures", () => {
    // Signing someone in on one of these would be badly wrong.
    const others = [
      { code: "manual_linking_disabled" },
      { code: "invalid_credentials" },
      { code: "user_banned" },
      { message: "invalid claim: missing sub claim" },
      { message: "Failed to fetch" },
      { message: "Identity not found" },
    ];
    for (const error of others) {
      expect(isIdentityAlreadyLinked(error)).toBe(false);
    }
  });

  it("never throws on malformed input", () => {
    for (const input of [null, undefined, "string", 42, {}, [], { code: 7 }]) {
      expect(isIdentityAlreadyLinked(input)).toBe(false);
    }
  });
});

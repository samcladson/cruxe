import { decodeJwtPayload, describeIdToken } from "../utils/jwt";

/** Builds a JWT-shaped string with the given payload. Signature is not real. */
function makeToken(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url({ alg: "RS256" })}.${b64url(payload)}.signature`;
}

const GOOGLE_ID_TOKEN = makeToken({
  iss: "https://accounts.google.com",
  aud: "1234-abc.apps.googleusercontent.com",
  sub: "110169484474386276334",
  email: "player@example.com",
  name: "Sam Cladson",
});

describe("decodeJwtPayload", () => {
  it("decodes a well-formed token's claims", () => {
    const claims = decodeJwtPayload(GOOGLE_ID_TOKEN);
    expect(claims).not.toBeNull();
    expect(claims!.sub).toBe("110169484474386276334");
    expect(claims!.iss).toBe("https://accounts.google.com");
  });

  it("decodes base64url padding variants", () => {
    // Payload lengths that land on each of the three padding cases.
    for (const name of ["a", "ab", "abc", "abcd", "abcde"]) {
      const claims = decodeJwtPayload(makeToken({ sub: "1", name }));
      expect(claims!.name).toBe(name);
    }
  });

  it("returns null for a serverAuthCode rather than throwing", () => {
    expect(decodeJwtPayload("4/0AeanS0bQ-opaque-auth-code")).toBeNull();
  });

  it("returns null for a JWT-shaped string with a non-JSON payload", () => {
    expect(decodeJwtPayload("header.bm90LWpzb24.sig")).toBeNull();
  });
});

describe("describeIdToken", () => {
  it("never includes the token itself", () => {
    const description = describeIdToken(GOOGLE_ID_TOKEN);
    expect(description).not.toContain(GOOGLE_ID_TOKEN);
    expect(description).not.toContain("signature");
  });

  it("reports the claim names, issuer, audience and whether sub is present", () => {
    const description = describeIdToken(GOOGLE_ID_TOKEN);
    expect(description).toContain("aud=1234-abc.apps.googleusercontent.com");
    expect(description).toContain("iss=https://accounts.google.com");
    expect(description).toContain("has sub: true");
  });

  it("calls out a token with no sub claim — the case that produced the bug report", () => {
    const noSub = makeToken({ iss: "supabase", role: "anon" });
    expect(describeIdToken(noSub)).toContain("has sub: false");
  });

  it("identifies an opaque serverAuthCode as not a JWT", () => {
    expect(describeIdToken("4/0AeanS0bQ-opaque")).toContain("not a JWT");
  });

  it("handles an empty or missing token", () => {
    expect(describeIdToken("")).toContain("empty");
    expect(describeIdToken(null)).toContain("empty");
    expect(describeIdToken(undefined)).toContain("empty");
  });
});

describe("decoding without a runtime atob (Hermes' old behaviour)", () => {
  const realAtob = globalThis.atob;
  beforeAll(() => {
    // The previous implementation used Buffer, which does not exist in
    // Hermes, so every diagnostic silently reported "would not decode".
    // The fallback decoder must produce the same claims.
    (globalThis as any).atob = undefined;
  });
  afterAll(() => {
    (globalThis as any).atob = realAtob;
  });

  it("still decodes the payload using the built-in fallback", () => {
    const claims = decodeJwtPayload(GOOGLE_ID_TOKEN);
    expect(claims!.sub).toBe("110169484474386276334");
    expect(claims!.name).toBe("Sam Cladson");
  });
});

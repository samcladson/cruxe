import {
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  revokeAppleAuthorization,
  AppleRevokeConfig,
} from "../supabase/functions/_shared/appleRevoke";

/**
 * Sign in with Apple token revocation on account deletion (App Store
 * guideline 5.1.1(v)). Apple hands the app a one-time authorisation code; the
 * server exchanges it for a token and revokes that. The whole thing is best
 * effort — deletion is a legal obligation and must never be blocked by Apple
 * being unreachable or the key being unset — so nothing here may throw.
 */

const CONFIG: AppleRevokeConfig = {
  clientId: "com.cruxe.app",
  teamId: "TEAMID1234",
  keyId: "KEYID12345",
  privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
};

const signClientSecret = jest.fn().mockResolvedValue("signed.client.secret");

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
  } as unknown as Response;
}

const form = (init: RequestInit | undefined) =>
  Object.fromEntries(new URLSearchParams(String(init?.body)));

beforeEach(() => signClientSecret.mockClear());

describe("revokeAppleAuthorization", () => {
  it("exchanges the code, then revokes the refresh token", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        response(200, { refresh_token: "r-tok", access_token: "a-tok" }),
      )
      .mockResolvedValueOnce(response(200, ""));

    const result = await revokeAppleAuthorization("the-code", CONFIG, {
      fetchFn,
      signClientSecret,
    });

    expect(result).toEqual({ status: "revoked" });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenInit] = fetchFn.mock.calls[0];
    expect(tokenUrl).toBe(APPLE_TOKEN_URL);
    expect(form(tokenInit)).toEqual({
      client_id: "com.cruxe.app",
      client_secret: "signed.client.secret",
      code: "the-code",
      grant_type: "authorization_code",
    });

    const [revokeUrl, revokeInit] = fetchFn.mock.calls[1];
    expect(revokeUrl).toBe(APPLE_REVOKE_URL);
    expect(form(revokeInit)).toEqual({
      client_id: "com.cruxe.app",
      client_secret: "signed.client.secret",
      token: "r-tok",
      token_type_hint: "refresh_token",
    });
  });

  it("falls back to the access token when Apple returns no refresh token", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(response(200, { access_token: "a-tok" }))
      .mockResolvedValueOnce(response(200, ""));

    await revokeAppleAuthorization("c", CONFIG, { fetchFn, signClientSecret });

    expect(form(fetchFn.mock.calls[1][1])).toMatchObject({
      token: "a-tok",
      token_type_hint: "access_token",
    });
  });

  it("skips, without calling Apple, when there is no code", async () => {
    const fetchFn = jest.fn();
    const result = await revokeAppleAuthorization(undefined, CONFIG, {
      fetchFn,
      signClientSecret,
    });
    expect(result).toEqual({ status: "skipped", reason: "no_code" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("skips when the server has no Apple key configured", async () => {
    const fetchFn = jest.fn();
    const result = await revokeAppleAuthorization("c", null, {
      fetchFn,
      signClientSecret,
    });
    expect(result).toEqual({ status: "skipped", reason: "not_configured" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reports failure, not a throw, when Apple rejects the code", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(response(400, { error: "invalid_grant" }));
    const result = await revokeAppleAuthorization("used", CONFIG, {
      fetchFn,
      signClientSecret,
    });
    expect(result.status).toBe("failed");
    expect((result as { reason: string }).reason).toContain("invalid_grant");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("reports failure when the revoke call itself is rejected", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(response(200, { refresh_token: "r" }))
      .mockResolvedValueOnce(response(400, { error: "invalid_client" }));
    const result = await revokeAppleAuthorization("c", CONFIG, {
      fetchFn,
      signClientSecret,
    });
    expect(result.status).toBe("failed");
  });

  it("swallows network errors and signing errors", async () => {
    const offline = jest.fn().mockRejectedValue(new Error("network down"));
    expect(
      (await revokeAppleAuthorization("c", CONFIG, { fetchFn: offline, signClientSecret }))
        .status,
    ).toBe("failed");

    const badKey = jest.fn().mockRejectedValue(new Error("bad key"));
    const fetchFn = jest.fn();
    const result = await revokeAppleAuthorization("c", CONFIG, {
      fetchFn,
      signClientSecret: badKey,
    });
    expect(result.status).toBe("failed");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

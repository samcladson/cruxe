/**
 * appleRevoke.ts — Revokes a user's Sign in with Apple grant on deletion.
 *
 * App Store guideline 5.1.1(v): an app that offers Sign in with Apple must
 * revoke the user's tokens when it deletes their account. Supabase's native
 * `signInWithIdToken` flow never holds a refresh token, so the app instead
 * re-asks Apple at deletion time for a one-time authorisation code, and this
 * exchanges that code for a token and revokes it.
 *
 * Best effort by design. Deleting an account is a legal obligation, so Apple
 * being unreachable, the key being unset, or a code that was already used must
 * report a result and never throw or block the deletion.
 *
 * The network client and the JWT signer are injected: signing needs `jose`,
 * which is a Deno-only import here, and injection keeps this testable.
 */

export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

export interface AppleRevokeConfig {
  /** The app's bundle id, which is the Sign in with Apple client id. */
  clientId: string;
  teamId: string;
  keyId: string;
  /** PKCS#8 PEM contents of the downloaded `.p8` key. */
  privateKey: string;
}

export interface AppleRevokeDeps {
  fetchFn: typeof fetch;
  /** Builds the ES256-signed client secret JWT Apple requires on both calls. */
  signClientSecret: (config: AppleRevokeConfig) => Promise<string>;
}

export type AppleRevokeResult =
  | { status: "revoked" }
  | { status: "skipped"; reason: "no_code" | "not_configured" }
  | { status: "failed"; reason: string };

const formBody = (fields: Record<string, string>) =>
  new URLSearchParams(fields).toString();

const FORM_HEADERS = { "Content-Type": "application/x-www-form-urlencoded" };

export async function revokeAppleAuthorization(
  authorizationCode: string | undefined | null,
  config: AppleRevokeConfig | null,
  { fetchFn, signClientSecret }: AppleRevokeDeps,
): Promise<AppleRevokeResult> {
  if (!authorizationCode) return { status: "skipped", reason: "no_code" };
  if (!config) return { status: "skipped", reason: "not_configured" };

  try {
    const clientSecret = await signClientSecret(config);

    const tokenRes = await fetchFn(APPLE_TOKEN_URL, {
      method: "POST",
      headers: FORM_HEADERS,
      body: formBody({
        client_id: config.clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return {
        status: "failed",
        reason: `token exchange ${tokenRes.status}: ${await tokenRes.text()}`,
      };
    }

    const tokens = (await tokenRes.json()) as {
      refresh_token?: string;
      access_token?: string;
    };
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) {
      return { status: "failed", reason: "token exchange returned no token" };
    }

    const revokeRes = await fetchFn(APPLE_REVOKE_URL, {
      method: "POST",
      headers: FORM_HEADERS,
      body: formBody({
        client_id: config.clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokens.refresh_token
          ? "refresh_token"
          : "access_token",
      }),
    });
    if (!revokeRes.ok) {
      return {
        status: "failed",
        reason: `revoke ${revokeRes.status}: ${await revokeRes.text()}`,
      };
    }

    return { status: "revoked" };
  } catch (e) {
    return {
      status: "failed",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

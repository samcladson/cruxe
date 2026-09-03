/**
 * jwt.ts — Read-only inspection of ID tokens, for diagnostics.
 *
 * Nothing here verifies a signature; it exists so a rejected token can be
 * described without logging the token itself. Kept free of Node globals:
 * `Buffer` does not exist in Hermes, and an earlier version of this decoder
 * used it, which meant every diagnostic silently reported "would not decode".
 */

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Minimal base64 decoder, used when the runtime has no `atob`. */
function decodeBase64(input: string): string {
  let out = "";
  let buffer = 0;
  let bits = 0;

  for (const char of input) {
    if (char === "=") break;
    const value = B64_ALPHABET.indexOf(char);
    if (value === -1) continue; // whitespace or padding noise
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

/**
 * Decodes a JWT's payload segment. Returns null when the input is not a
 * three-segment token or the payload is not JSON.
 */
export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  try {
    const raw =
      typeof globalThis.atob === "function"
        ? globalThis.atob(base64)
        : decodeBase64(base64);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Describes an ID token without revealing it.
 *
 * "invalid claim: missing sub claim" from GoTrue means the string we sent was
 * not a usable ID token. The usual culprits are a serverAuthCode (opaque, not
 * a JWT) sent by mistake, or a token from a different OAuth client than the
 * one Supabase is configured with. Both are invisible unless you look, and
 * neither is safe to diagnose by printing the token.
 */
export function describeIdToken(token: string | null | undefined): string {
  if (!token) return "the token was empty or null.";

  const parts = token.split(".");
  if (parts.length !== 3) {
    return (
      `not a JWT: ${parts.length} segment(s), length ${token.length}. ` +
      "This is usually a serverAuthCode rather than an ID token."
    );
  }

  const claims = decodeJwtPayload(token);
  if (!claims) {
    return `JWT-shaped (3 segments, length ${token.length}) but the payload would not decode.`;
  }

  return [
    `claims: ${Object.keys(claims).sort().join(", ")}`,
    `iss=${claims.iss ?? "(none)"}`,
    `aud=${claims.aud ?? "(none)"}`,
    `has sub: ${Boolean(claims.sub)}`,
  ].join(" | ");
}

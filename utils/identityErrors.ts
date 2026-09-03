/**
 * identityErrors.ts — Recognising Supabase's "this identity is spoken for".
 *
 * Kept out of authService so it can be tested without loading the Google
 * Sign-In and Apple Authentication native modules.
 */

/**
 * True when Supabase refused to link a provider identity because an account
 * already owns it.
 *
 * This is the signal to sign into that account instead of linking. Getting it
 * wrong in either direction is bad: missing it strands a returning player
 * outside their own account, and matching too broadly would sign someone in
 * on an unrelated failure.
 */
export function isIdentityAlreadyLinked(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const code = (error as { code?: unknown }).code;
  if (code === "identity_already_exists") return true;

  const message = (error as { message?: unknown }).message;
  return typeof message === "string"
    ? /identity is already linked/i.test(message)
    : false;
}

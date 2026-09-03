/**
 * displayName.ts — Reshapes provider-supplied names for `set_display_name`.
 *
 * Kept apart from authService so it can be tested without pulling in the
 * Google Sign-In and Apple Authentication native modules.
 */

/** Mirrors the constraints enforced by the set_display_name RPC. */
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;

export interface ProviderName {
  full?: string | null;
  given?: string | null;
}

/**
 * Reshapes a provider-supplied name into something set_display_name accepts:
 * 2-20 characters of [A-Za-z0-9 _'-]. Returns null when nothing usable is left.
 *
 * Accents are folded rather than dropped, so "José" becomes "Jose" instead of
 * "Jos". A name too long to fit falls back to its first word, because
 * truncating "Bartholomew Cadwallader" mid-word reads worse than "Bartholomew".
 */
export function sanitiseDisplayName(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;

  // Hermes has shipped String.prototype.normalize for a while, but a missing
  // one would throw on every sign-in, so it is worth the guard.
  const decomposed =
    typeof raw.normalize === "function" ? raw.normalize("NFD") : raw;

  const cleaned = decomposed
    .replace(/[\u0300-\u036f]/g, "") // combining accents left by NFD
    .replace(/[^A-Za-z0-9 _'-]/g, " ") // the RPC's charset; the rest becomes space
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < DISPLAY_NAME_MIN) return null;
  if (cleaned.length <= DISPLAY_NAME_MAX) return cleaned;

  const firstWord = cleaned.split(" ")[0];
  const clipped = (firstWord.length >= DISPLAY_NAME_MIN ? firstWord : cleaned)
    .slice(0, DISPLAY_NAME_MAX)
    .trim();
  return clipped.length >= DISPLAY_NAME_MIN ? clipped : null;
}

/** Prefers the full name, falling back to the given name alone. */
export function pickProviderName(name: ProviderName): string | null {
  return sanitiseDisplayName(name.full) ?? sanitiseDisplayName(name.given);
}

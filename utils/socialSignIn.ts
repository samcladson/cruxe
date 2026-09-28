/**
 * What a Google or Apple sign-in attempt amounted to, for the screen that
 * started it.
 *
 * Cancelling a provider's sheet is not an error, but it is not a sign-in
 * either. It used to come back as `{ error: null }`, indistinguishable from
 * success, so the welcome screen carried on into the app with no session.
 */
export type SocialSignInOutcome = "signed-in" | "cancelled" | "failed";

export function socialSignInOutcome<
  T extends { error: Error | null; cancelled?: boolean },
>(result: T): SocialSignInOutcome {
  if (result.error) return "failed";
  if (result.cancelled) return "cancelled";
  return "signed-in";
}

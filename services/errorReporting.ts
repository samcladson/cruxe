/**
 * errorReporting.ts — the one place a caught error becomes a Sentry issue.
 *
 * `console.warn` is invisible in a release build, so an error that is caught
 * and logged is an error nobody will ever hear about. Anything that reaches
 * here is a real failure worth an issue; expected paths (offline, user
 * cancelled a purchase) should keep logging and stay out of the stream.
 *
 * Mirrors `analyticsService.track`: one funnel in, one vendor to change.
 */
import * as Sentry from "@sentry/react-native";

/**
 * Report a caught error, tagged with where it came from.
 *
 * @param scope  Subsystem the failure belongs to — becomes a Sentry tag, so
 *               keep the set small and stable enough to group and filter on.
 * @param error  The caught value. Non-Error throws are wrapped, because
 *               Sentry discards a bare string and the report vanishes.
 */
export function reportError(
  scope: "auth" | "purchases" | "sync" | "puzzle" | "render",
  error: unknown,
  extra: Record<string, string | number | boolean> = {},
): void {
  if (__DEV__) {
    console.error(`[${scope}]`, error, extra);
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));

  Sentry.captureException(err, {
    tags: { scope },
    extra,
  });
}

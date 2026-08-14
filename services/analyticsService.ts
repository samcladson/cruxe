/**
 * analyticsService.ts — A deliberately small funnel.
 *
 * Every event here answers a question sub-projects 2 (economy rebalance) and
 * 3 (retention) will ask. Add nothing that nobody has agreed to look at —
 * unused events still have to be declared in App Privacy and Data Safety.
 *
 * Events route to Sentry breadcrumbs, so a crash arrives carrying the funnel
 * that preceded it, with no second vendor and no extra consent surface.
 * Swapping in a product-analytics SDK later means changing only `track`.
 */
import * as Sentry from "@sentry/react-native";

export type AnalyticsEvent =
  | "onboarding_started"
  | "onboarding_completed"
  | "first_solve"
  | "puzzle_started"
  | "puzzle_completed"
  | "puzzle_abandoned"
  | "hint_used"
  | "store_viewed"
  | "purchase_started"
  | "purchase_completed"
  | "purchase_failed"
  | "daily_bonus_claimed"
  | "streak_broken";

export function track(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean> = {},
): void {
  if (__DEV__) {
    console.log("[analytics]", event, properties);
    return;
  }
  Sentry.addBreadcrumb({
    category: "analytics",
    message: event,
    level: "info",
    data: properties,
  });
}

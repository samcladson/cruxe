/**
 * redactPayload.ts — Strips personal data from a retained purchase event.
 *
 * `iap_events` is ON DELETE SET NULL rather than CASCADE because purchase
 * records have to outlive the account for accounting and dispute handling.
 * Nulling the foreign key is not enough on its own: the raw RevenueCat
 * payload embeds the app_user_id (and often an email, aliases, and attribution
 * ids), so without this the identifier survives the "permanent erasure" the
 * user was promised.
 *
 * Written as an allowlist, not a blocklist. RevenueCat adds fields over time,
 * and a blocklist silently leaks every field invented after it was written.
 */

/** The only fields kept — what accounting and dispute handling actually need. */
export const RETAINED_FIELDS: readonly string[] = [
  "type",
  "event_timestamp_ms",
  "product_id",
  "period_type",
  "purchased_at_ms",
  "expiration_at_ms",
  "store",
  "environment",
  "price",
  "price_in_purchased_currency",
  "currency",
  "country_code",
  "transaction_id",
  "original_transaction_id",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function redactPayload(
  payload: unknown,
  now: () => string = () => new Date().toISOString(),
): Record<string, unknown> {
  // RevenueCat webhooks arrive as { event: {...} }; rows written from other
  // paths store the event object directly. Handle both, and anything else
  // by keeping nothing at all.
  let source: Record<string, unknown> = {};
  if (isPlainObject(payload)) {
    source = isPlainObject(payload.event) ? payload.event : payload;
  }

  const kept: Record<string, unknown> = {};
  for (const field of RETAINED_FIELDS) {
    if (field in source) kept[field] = source[field];
  }

  // Defence in depth: an allowlisted field whose own value carries nested
  // objects could smuggle identifiers back in. Only scalars survive.
  for (const [key, value] of Object.entries(kept)) {
    if (value !== null && typeof value === "object") delete kept[key];
  }

  return { ...kept, redacted: true, redacted_at: now() };
}

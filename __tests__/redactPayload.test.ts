import {
  redactPayload,
  RETAINED_FIELDS,
} from "../supabase/functions/_shared/redactPayload";

/**
 * A real RevenueCat webhook body, trimmed but structurally faithful. The
 * identifiers here are exactly what must not survive account deletion.
 */
const REVENUECAT_WEBHOOK = {
  api_version: "1.0",
  event: {
    type: "NON_RENEWING_PURCHASE",
    id: "9F1B2C3D",
    app_user_id: "8f14e45f-ea6a-4c1b-9f2f-3d7e5a6b8c90",
    original_app_user_id: "8f14e45f-ea6a-4c1b-9f2f-3d7e5a6b8c90",
    aliases: [
      "8f14e45f-ea6a-4c1b-9f2f-3d7e5a6b8c90",
      "$RCAnonymousID:abc123",
    ],
    subscriber_attributes: {
      $email: { value: "player@example.com" },
      $displayName: { value: "Sam Cladson" },
    },
    product_id: "coins_500",
    price: 4.99,
    currency: "USD",
    store: "PLAY_STORE",
    environment: "PRODUCTION",
    country_code: "IN",
    transaction_id: "GPA.1234-5678",
    purchased_at_ms: 1756900000000,
    event_timestamp_ms: 1756900001000,
  },
};

/** Every identifier that must be gone, wherever it appears in the output. */
const IDENTIFIERS = [
  "8f14e45f-ea6a-4c1b-9f2f-3d7e5a6b8c90",
  "player@example.com",
  "Sam Cladson",
  "$RCAnonymousID:abc123",
];

const FROZEN_NOW = () => "2026-09-03T00:00:00.000Z";

describe("redactPayload", () => {
  it("removes every personal identifier from a real webhook shape", () => {
    const out = redactPayload(REVENUECAT_WEBHOOK, FROZEN_NOW);
    const serialised = JSON.stringify(out);

    for (const identifier of IDENTIFIERS) {
      expect(serialised).not.toContain(identifier);
    }
    expect(out).not.toHaveProperty("app_user_id");
    expect(out).not.toHaveProperty("aliases");
    expect(out).not.toHaveProperty("subscriber_attributes");
  });

  it("keeps what accounting needs", () => {
    const out = redactPayload(REVENUECAT_WEBHOOK, FROZEN_NOW);
    expect(out.product_id).toBe("coins_500");
    expect(out.price).toBe(4.99);
    expect(out.currency).toBe("USD");
    expect(out.store).toBe("PLAY_STORE");
    expect(out.transaction_id).toBe("GPA.1234-5678");
    expect(out.purchased_at_ms).toBe(1756900000000);
  });

  it("marks the row as redacted so the state is auditable", () => {
    const out = redactPayload(REVENUECAT_WEBHOOK, FROZEN_NOW);
    expect(out.redacted).toBe(true);
    expect(out.redacted_at).toBe("2026-09-03T00:00:00.000Z");
  });

  it("handles an event object stored without the webhook envelope", () => {
    const out = redactPayload(REVENUECAT_WEBHOOK.event, FROZEN_NOW);
    expect(out.product_id).toBe("coins_500");
    expect(JSON.stringify(out)).not.toContain("player@example.com");
  });

  it("is an allowlist, so fields invented later cannot leak", () => {
    const out = redactPayload(
      {
        event: {
          product_id: "coins_500",
          some_future_field_with_pii: "player@example.com",
          another_new_id: "8f14e45f-ea6a-4c1b-9f2f-3d7e5a6b8c90",
        },
      },
      FROZEN_NOW,
    );
    const kept = Object.keys(out).filter(
      (k) => k !== "redacted" && k !== "redacted_at",
    );
    expect(kept).toEqual(["product_id"]);
  });

  it("drops nested objects even under an allowlisted key", () => {
    // A retained key whose value is an object could smuggle identifiers back.
    const out = redactPayload(
      { event: { store: { name: "PLAY_STORE", account: "player@example.com" } } },
      FROZEN_NOW,
    );
    expect(out).not.toHaveProperty("store");
    expect(JSON.stringify(out)).not.toContain("player@example.com");
  });

  it("never throws on malformed input", () => {
    for (const input of [null, undefined, "string", 42, [], [{ a: 1 }], {}]) {
      const out = redactPayload(input, FROZEN_NOW);
      expect(out.redacted).toBe(true);
      expect(Object.keys(out).sort()).toEqual(["redacted", "redacted_at"]);
    }
  });

  it("only ever emits allowlisted keys plus the redaction markers", () => {
    const out = redactPayload(REVENUECAT_WEBHOOK, FROZEN_NOW);
    const allowed = new Set([...RETAINED_FIELDS, "redacted", "redacted_at"]);
    for (const key of Object.keys(out)) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});

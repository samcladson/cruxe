import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;

/** Length-safe constant-time comparison. */
function secureEquals(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Events that grant coins, and those that take them back. */
const GRANT_TYPES = new Set(["NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"]);
const REFUND_TYPES = new Set(["CANCELLATION", "REFUND"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const provided = req.headers.get("Authorization") ?? "";
  if (!WEBHOOK_SECRET || !secureEquals(provided, WEBHOOK_SECRET)) {
    console.warn("[revenuecat-webhook] rejected: bad or missing secret");
    return json({ error: "unauthorized" }, 401);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const event = payload?.event;
  if (!event?.id) return json({ error: "bad_event" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const userId: string | null = event.app_user_id ?? null;
  const productId: string | null = event.product_id ?? null;
  const type: string = event.type ?? "UNKNOWN";

  // Always record the raw event first, so a later failure is still auditable.
  await db.from("iap_events").upsert(
    {
      event_id: String(event.id),
      user_id: userId,
      product_id: productId,
      event_type: type,
      is_sandbox: event.environment === "SANDBOX",
      payload,
    },
    { onConflict: "event_id" },
  );

  const isRefund = REFUND_TYPES.has(type);
  if (!GRANT_TYPES.has(type) && !isRefund) {
    return json({ ok: true, ignored: type });
  }

  if (!userId || !productId) {
    console.error(
      "[revenuecat-webhook] missing app_user_id or product_id",
      event.id,
    );
    return json({ error: "incomplete_event" }, 400);
  }

  const { data, error } = await db.rpc("credit_purchase", {
    p_user_id: userId,
    p_product_id: productId,
    p_event_id: String(event.id),
    p_is_refund: isRefund,
  });

  if (error) {
    // An unknown SKU is a configuration bug, not a transient failure.
    // Return 200 so RevenueCat stops retrying, but log loudly.
    if (error.message?.includes("unknown_product")) {
      console.error(
        "[revenuecat-webhook] UNKNOWN SKU — add it to coin_products:",
        productId,
      );
      return json({ error: "unknown_product", productId }, 200);
    }
    console.error("[revenuecat-webhook] credit failed", error);
    return json({ error: "credit_failed" }, 500); // 5xx => RevenueCat retries
  }

  return json({ ok: true, ...data });
});

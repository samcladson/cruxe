import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Credits any purchase RevenueCat knows about that we have no ledger entry
 * for. This is the safety net for a dropped webhook, and what makes the
 * "Restore Purchases" button meaningful for consumables — the store does not
 * restore those, so without this the button can only ever be decorative.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  const rcRes = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${RC_SECRET_KEY}` } },
  );
  if (!rcRes.ok) {
    console.error("[sync-purchases] RevenueCat lookup failed", rcRes.status);
    return json({ error: "revenuecat_unavailable" }, 502);
  }

  const body = await rcRes.json();
  const nonSubs: Record<string, any[]> =
    body?.subscriber?.non_subscriptions ?? {};

  let credited = 0;
  for (const [productId, purchases] of Object.entries(nonSubs)) {
    for (const purchase of purchases) {
      const eventId = `sync_${purchase.id ?? purchase.store_transaction_id}`;

      const { data: seen } = await db
        .from("iap_events")
        .select("event_id")
        .eq("event_id", eventId)
        .maybeSingle();
      if (seen) continue;

      await db.from("iap_events").upsert(
        {
          event_id: eventId,
          user_id: userId,
          product_id: productId,
          event_type: "SYNC_RECONCILE",
          is_sandbox: Boolean(purchase.is_sandbox),
          payload: purchase,
        },
        { onConflict: "event_id" },
      );

      const { error } = await db.rpc("credit_purchase", {
        p_user_id: userId,
        p_product_id: productId,
        p_event_id: eventId,
        p_is_refund: false,
      });
      if (!error) credited++;
      else {
        console.error(
          "[sync-purchases] credit failed",
          productId,
          error.message,
        );
      }
    }
  }

  const { data: profile } = await db
    .from("users")
    .select("coins")
    .eq("id", userId)
    .single();

  return json({ credited, balance: profile?.coins ?? 0 });
});

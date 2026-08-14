import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Permanent account deletion. Required by Apple guideline 5.1.1(v) and
 * Google Play policy for any app that creates accounts.
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

  // Best-effort RevenueCat subscriber deletion; never block account removal
  // on a third party being reachable.
  if (RC_SECRET_KEY) {
    try {
      await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${RC_SECRET_KEY}` },
        },
      );
    } catch (e) {
      console.warn("[delete-account] RevenueCat delete failed", e);
    }
  }

  // Cascades clear users, coin_ledger, hint_events, and puzzle_completions.
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[delete-account] deleteUser failed", error);
    return json({ error: "delete_failed" }, 500);
  }

  return json({ ok: true });
});

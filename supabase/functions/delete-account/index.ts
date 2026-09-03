import { createClient } from "jsr:@supabase/supabase-js@2";
import { redactPayload } from "../_shared/redactPayload.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Abandons a third-party call that hangs, so it cannot stall the deletion. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
  );
  return await Promise.race([work, timeout]);
}

/**
 * Permanent account deletion. Required by Apple guideline 5.1.1(v) and
 * Google Play policy for any app that creates accounts.
 *
 * Ordered so that a failure at any step leaves the account either fully
 * intact or fully gone, never half-erased:
 *
 *  1. Redact retained purchase payloads. Done BEFORE the auth delete,
 *     because afterwards `user_id` is null and the rows can no longer be
 *     found. A failure here aborts, with the account still intact.
 *  2. Best-effort RevenueCat subscriber delete — a third party being down
 *     must not block a legal obligation.
 *  3. Delete the auth user. Cascades clear users, coin_ledger, hint_events,
 *     puzzle_completions, puzzle_entries and streak_repairs.
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

  if (userErr || !userData.user) {
    // A token whose subject is already gone means a previous attempt
    // succeeded and the client never saw the response. Reporting failure
    // would send the client back to a screen for an account that no longer
    // exists, so a retry of a completed deletion is a success.
    const alreadyDeleted =
      userErr?.status === 401 ||
      userErr?.status === 403 ||
      userErr?.status === 404;
    if (alreadyDeleted) {
      console.log("[delete-account] Token subject already gone; treating as done");
      return json({ ok: true, already_deleted: true });
    }
    return json({ error: "unauthenticated" }, 401);
  }

  const userId = userData.user.id;

  // ── 1. Retained financial records lose their personal content.
  const { data: events, error: readErr } = await db
    .from("iap_events")
    .select("event_id, payload")
    .eq("user_id", userId);

  if (readErr) {
    // Deliberately not fatal. Account deletion is a legal obligation; an
    // auxiliary audit table being unreadable — missing on this project,
    // renamed, permissions changed — must not be able to block it. There is
    // also no PII to strand here: nothing was found to redact.
    console.error(
      "[delete-account] Could not read iap_events; continuing without " +
        "redaction",
      readErr,
    );
  }

  for (const event of events ?? []) {
    const { error: redactErr } = await db
      .from("iap_events")
      .update({ payload: redactPayload(event.payload) })
      .eq("event_id", event.event_id);

    if (redactErr) {
      // Deleting the account now would strand an un-redacted payload that
      // can no longer be located by user_id. Better to fail loudly with the
      // account intact, so the user can retry.
      console.error("[delete-account] Redaction failed", redactErr);
      return json(
        {
          error:
            "delete_failed: could not redact a stored purchase record " +
            `(${redactErr.message}). The account was not deleted.`,
        },
        500,
      );
    }
  }

  // ── 2. Best-effort third-party cleanup; never block account removal on it.
  if (RC_SECRET_KEY) {
    try {
      await withTimeout(
        fetch(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${RC_SECRET_KEY}` },
          },
        ),
        5000,
      );
    } catch (e) {
      console.warn("[delete-account] RevenueCat delete failed", e);
    }
  }

  // ── 3. Cascades clear users, coin_ledger, hint_events, puzzle_completions,
  //       puzzle_entries and streak_repairs.
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    // The message is included in the response, not just the logs. A bare
    // "delete_failed" reaching the app told the user — and whoever had to
    // debug it — nothing at all, and the cause here is almost always
    // something specific and fixable: a foreign key without ON DELETE
    // CASCADE, a missing migration, a trigger raising. This is the owner's
    // own account being deleted, so there is nothing to disclose to a
    // third party.
    console.error("[delete-account] deleteUser failed", error);
    return json(
      {
        error: `delete_failed: ${error.message ?? "unknown error"}`,
        status: error.status ?? null,
      },
      500,
    );
  }

  return json({ ok: true });
});

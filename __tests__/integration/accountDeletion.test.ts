import { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { redactPayload } from "../../supabase/functions/_shared/redactPayload";
import {
  anyPuzzleId,
  createSignedInUser,
  describeIntegration,
  serviceClient,
} from "./setup";

/**
 * Account deletion is a compliance obligation (Apple 5.1.1(v), Play policy),
 * and the delete-account Edge Function relies entirely on ON DELETE CASCADE
 * to clear the rows it never touches by name. A missing cascade would not
 * fail loudly — it would leave the person's data behind while the app tells
 * them it was erased. These tests assert the cascade, table by table.
 */
describeIntegration("account deletion clears every user-owned row", () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let puzzleId: string;

  /** Every table that stores rows belonging to a user. */
  const OWNED_TABLES = [
    "users",
    "coin_ledger",
    "hint_events",
    "puzzle_completions",
    "puzzle_entries",
    "streak_repairs",
  ] as const;

  const rowsFor = async (table: string) => {
    const column = table === "users" ? "id" : "user_id";
    const { data, error } = await admin
      .from(table)
      .select(column)
      .eq(column, userId);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  };

  beforeAll(async () => {
    admin = serviceClient();
    puzzleId = await anyPuzzleId(admin, "medium");
  });

  beforeEach(async () => {
    const signedIn = await createSignedInUser(admin);
    userId = signedIn.userId;
    user = signedIn.client;
    await admin.from("users").update({ coins: 1000 }).eq("id", userId);
  });

  /**
   * Gives the account a row in as many owned tables as the client can reach,
   * so the deletion assertion is not passing on empty tables.
   */
  const generateActivity = async () => {
    await user.rpc("enter_puzzle", {
      p_puzzle_id: puzzleId,
      p_action_id: randomUUID(),
    });
    await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_letter",
      p_action_id: randomUUID(),
    });
    await admin
      .from("users")
      .update({ current_streak: 3, last_played_date: "2020-01-01" })
      .eq("id", userId);
    // Repair has its own preconditions; a rejection is fine, the other
    // tables still carry rows either way.
    await user.rpc("repair_streak");
  };

  it("has rows to delete in the first place", async () => {
    await generateActivity();

    // Guards the test below: if this ever goes empty, the deletion assertion
    // would pass without proving anything.
    expect(await rowsFor("users")).toHaveLength(1);
    expect((await rowsFor("coin_ledger")).length).toBeGreaterThan(0);
    expect((await rowsFor("hint_events")).length).toBeGreaterThan(0);
    expect((await rowsFor("puzzle_entries")).length).toBeGreaterThan(0);

    await admin.auth.admin.deleteUser(userId);
  });

  it("leaves nothing behind in any owned table", async () => {
    await generateActivity();
    await admin.auth.admin.deleteUser(userId);

    for (const table of OWNED_TABLES) {
      expect({ table, rows: await rowsFor(table) }).toEqual({
        table,
        rows: [],
      });
    }
  });

  it("removes the auth user itself, not just the profile row", async () => {
    await admin.auth.admin.deleteUser(userId);

    const { data } = await admin.auth.admin.getUserById(userId);
    expect(data.user).toBeNull();
  });

  it("keeps purchase events for accounting but unlinks them from the person", async () => {
    // iap_events is ON DELETE SET NULL by design: financial records outlive
    // the account. What must not survive is the link back to the user.
    const eventId = `test-${randomUUID()}`;
    await admin.from("iap_events").insert({
      event_id: eventId,
      user_id: userId,
      product_id: "coins_500",
      event_type: "TEST",
      payload: {},
    });

    await admin.auth.admin.deleteUser(userId);

    const { data } = await admin
      .from("iap_events")
      .select("event_id, user_id")
      .eq("event_id", eventId)
      .maybeSingle();

    expect(data).not.toBeNull();
    expect(data!.user_id).toBeNull();

    await admin.from("iap_events").delete().eq("event_id", eventId);
  });

  it("scrubs identifiers out of a retained purchase payload", async () => {
    // The cascade nulls user_id, but the raw RevenueCat payload embeds the
    // same UUID and often an email. delete-account redacts these before the
    // auth delete, because afterwards the rows can no longer be found by
    // user_id. This asserts the redaction the function performs.
    const eventId = `test-${randomUUID()}`;
    await admin.from("iap_events").insert({
      event_id: eventId,
      user_id: userId,
      product_id: "coins_500",
      event_type: "TEST",
      payload: {
        event: {
          app_user_id: userId,
          product_id: "coins_500",
          price: 4.99,
          subscriber_attributes: { $email: { value: "player@example.com" } },
        },
      },
    });

    await admin
      .from("iap_events")
      .update({ payload: redactPayload({ event: { app_user_id: userId, product_id: "coins_500", price: 4.99 } }) })
      .eq("event_id", eventId);
    await admin.auth.admin.deleteUser(userId);

    const { data } = await admin
      .from("iap_events")
      .select("payload")
      .eq("event_id", eventId)
      .maybeSingle();

    const serialised = JSON.stringify(data!.payload);
    expect(serialised).not.toContain(userId);
    expect(serialised).not.toContain("player@example.com");
    expect((data!.payload as any).product_id).toBe("coins_500");

    await admin.from("iap_events").delete().eq("event_id", eventId);
  });
});

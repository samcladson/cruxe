import { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestUser,
  deleteTestUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("ledger_apply", () => {
  let db: SupabaseClient;
  let userId: string;

  beforeAll(() => {
    db = serviceClient();
  });

  beforeEach(async () => {
    userId = await createTestUser(db);
    // Start from a known zero so assertions are absolute, not relative to
    // whatever the welcome-bonus trigger granted.
    await db.from("users").update({ coins: 0 }).eq("id", userId);
    await db.from("coin_ledger").delete().eq("user_id", userId);
  });

  afterEach(async () => {
    await deleteTestUser(db, userId);
  });

  const apply = (delta: number, reason: string, key: string, allowNeg = false) =>
    db.rpc("ledger_apply", {
      p_user_id: userId,
      p_delta: delta,
      p_reason: reason,
      p_idempotency_key: key,
      p_metadata: {},
      p_allow_negative: allowNeg,
    });

  it("credits and returns the new balance", async () => {
    const { data, error } = await apply(200, "welcome_bonus", `w:${userId}`);
    expect(error).toBeNull();
    expect(data).toBe(200);
  });

  it("is idempotent — the same key applies once", async () => {
    await apply(200, "welcome_bonus", `w:${userId}`);
    const { data } = await apply(200, "welcome_bonus", `w:${userId}`);
    expect(data).toBe(200);

    const { count } = await db
      .from("coin_ledger")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(1);
  });

  it("refuses to overdraw", async () => {
    await apply(50, "welcome_bonus", `w:${userId}`);
    const { error } = await apply(-80, "entry_fee", `e:${userId}`);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("insufficient_coins");

    const { data: row } = await db
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    expect(row!.coins).toBe(50);
  });

  it("allows refunds to drive the balance negative", async () => {
    await apply(100, "iap_purchase", `p:${userId}`);
    await apply(-100, "entry_fee", `e:${userId}`);
    const { data } = await apply(-100, "refund", `r:${userId}`, true);
    expect(data).toBe(-100);
  });

  it("serialises concurrent debits without overdrawing", async () => {
    await apply(100, "welcome_bonus", `w:${userId}`);
    const results = await Promise.all([
      apply(-60, "hint_reveal_letter", `h1:${userId}`),
      apply(-60, "hint_reveal_letter", `h2:${userId}`),
    ]);
    const failures = results.filter((r) => r.error !== null);
    expect(failures).toHaveLength(1);

    const { data: row } = await db
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    expect(row!.coins).toBe(40);
  });

  it("rejects a zero delta", async () => {
    const { error } = await apply(0, "admin_adjust", `z:${userId}`);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("delta_must_be_nonzero");
  });
});

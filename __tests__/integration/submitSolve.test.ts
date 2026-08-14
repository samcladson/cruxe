import { SupabaseClient } from "@supabase/supabase-js";
import {
  anyPuzzleId,
  createTestUser,
  deleteTestUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("submit_solve and credit_purchase", () => {
  let db: SupabaseClient;
  let userId: string;
  let puzzleId: string;

  beforeAll(async () => {
    db = serviceClient();
    puzzleId = await anyPuzzleId(db, "medium");
    await db.from("coin_products").upsert({
      product_id: "test.coins.500",
      coins: 500,
      display_name: "Test 500",
    });
  });

  beforeEach(async () => {
    userId = await createTestUser(db);
    await db
      .from("users")
      .update({
        coins: 0,
        total_score: 0,
        puzzles_solved: 0,
        current_streak: 0,
        last_played_date: null,
      })
      .eq("id", userId);
    await db.from("coin_ledger").delete().eq("user_id", userId);
  });

  afterEach(async () => {
    await deleteTestUser(db, userId);
  });

  const submit = (score = 200) =>
    db.rpc("submit_solve", {
      p_user_id: userId,
      p_puzzle_id: puzzleId,
      p_accuracy: 1.0,
      p_time_seconds: 300,
      p_reported_time: 300,
      p_hints_used: 0,
      p_score: score,
      p_suspect: false,
    });

  it("records the completion, credits the reward, and updates totals", async () => {
    const { data, error } = await submit(200);
    expect(error).toBeNull();
    expect(data.coins_earned).toBe(25); // medium
    expect(data.balance).toBe(25);

    const { data: u } = await db
      .from("users")
      .select("total_score, puzzles_solved, current_streak")
      .eq("id", userId)
      .single();
    expect(u!.total_score).toBe(200);
    expect(u!.puzzles_solved).toBe(1);
    expect(u!.current_streak).toBe(1);
  });

  it("replays to the original result without paying twice", async () => {
    await submit(200);
    const { data } = await submit(999);
    expect(data.replayed).toBe(true);
    expect(data.score).toBe(200);
    expect(data.balance).toBe(25);
  });

  it("increments puzzle_stats", async () => {
    const { data: before } = await db
      .from("puzzle_stats")
      .select("players_completed")
      .eq("puzzle_id", puzzleId)
      .maybeSingle();
    const start = before?.players_completed ?? 0;

    await submit(200);

    const { data: after } = await db
      .from("puzzle_stats")
      .select("players_completed")
      .eq("puzzle_id", puzzleId)
      .single();
    expect(after!.players_completed).toBe(start + 1);
  });

  it("credits a purchase once per event id", async () => {
    const a = await db.rpc("credit_purchase", {
      p_user_id: userId,
      p_product_id: "test.coins.500",
      p_event_id: `evt_${userId}_1`,
      p_is_refund: false,
    });
    const b = await db.rpc("credit_purchase", {
      p_user_id: userId,
      p_product_id: "test.coins.500",
      p_event_id: `evt_${userId}_1`,
      p_is_refund: false,
    });
    expect(a.data.balance).toBe(500);
    expect(b.data.balance).toBe(500);
    expect(b.data.replayed).toBe(true);
  });

  it("rejects an unknown SKU rather than guessing", async () => {
    const { error } = await db.rpc("credit_purchase", {
      p_user_id: userId,
      p_product_id: "cruxe_pack_v2",
      p_event_id: `evt_${userId}_2`,
      p_is_refund: false,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("unknown_product");
  });

  it("lets a refund drive the balance negative", async () => {
    await db.rpc("credit_purchase", {
      p_user_id: userId,
      p_product_id: "test.coins.500",
      p_event_id: `evt_${userId}_3`,
      p_is_refund: false,
    });
    await db.rpc("ledger_apply", {
      p_user_id: userId,
      p_delta: -500,
      p_reason: "entry_fee",
      p_idempotency_key: `spend:${userId}`,
      p_metadata: {},
      p_allow_negative: false,
    });
    const { data } = await db.rpc("credit_purchase", {
      p_user_id: userId,
      p_product_id: "test.coins.500",
      p_event_id: `evt_${userId}_3`,
      p_is_refund: true,
    });
    expect(data.balance).toBe(-500);
  });

  it("keeps the ledger and the materialised balance in agreement", async () => {
    await submit(200);
    await db.rpc("credit_purchase", {
      p_user_id: userId,
      p_product_id: "test.coins.500",
      p_event_id: `evt_${userId}_4`,
      p_is_refund: false,
    });

    const { data: rows } = await db
      .from("coin_ledger")
      .select("delta")
      .eq("user_id", userId);
    const sum = (rows ?? []).reduce((t, r) => t + r.delta, 0);

    const { data: u } = await db
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    expect(u!.coins).toBe(sum);
  });
});

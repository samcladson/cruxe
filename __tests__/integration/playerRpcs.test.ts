import { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
  anyPuzzleId,
  createSignedInUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("player economy RPCs", () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let puzzleId: string;

  beforeAll(async () => {
    admin = serviceClient();
    puzzleId = await anyPuzzleId(admin, "medium");
  });

  beforeEach(async () => {
    const signedIn = await createSignedInUser(admin);
    userId = signedIn.userId;
    user = signedIn.client;
    // Known starting state, independent of the welcome bonus.
    await admin
      .from("users")
      .update({ coins: 500, current_streak: 2, last_daily_bonus_date: null })
      .eq("id", userId);
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
  });

  it("charges the configured reveal_letter price, not a client price", async () => {
    const { data, error } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_letter",
      p_action_id: randomUUID(),
      p_letter_count: 1,
    });
    expect(error).toBeNull();
    expect(data.cost).toBe(30);
    expect(data.balance).toBe(470);
  });

  it("prices reveal_word per letter and clamps an inflated count", async () => {
    const { data, error } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_word",
      p_action_id: randomUUID(),
      p_letter_count: 9999,
    });
    expect(error).toBeNull();
    // Clamped to the longest clue in the puzzle, so cost stays sane.
    expect(data.cost).toBeLessThanOrEqual(30 * 12);
    expect(data.cost).toBeGreaterThan(0);
  });

  it("replays a hint action_id without double-charging", async () => {
    const action = randomUUID();
    const a = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_letter",
      p_action_id: action,
      p_letter_count: 1,
    });
    const b = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_letter",
      p_action_id: action,
      p_letter_count: 1,
    });
    expect(a.data.balance).toBe(470);
    expect(b.data.balance).toBe(470);
    expect(b.data.replayed).toBe(true);
  });

  it("gives the first five error checks free, then charges", async () => {
    for (let i = 0; i < 5; i++) {
      const { data } = await user.rpc("spend_on_hint", {
        p_puzzle_id: puzzleId,
        p_hint_type: "check_errors",
        p_action_id: randomUUID(),
        p_letter_count: 0,
      });
      expect(data.cost).toBe(0);
    }
    const { data } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "check_errors",
      p_action_id: randomUUID(),
      p_letter_count: 0,
    });
    expect(data.cost).toBe(20);
  });

  it("rejects an unknown hint type", async () => {
    const { error } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "free_answers_please",
      p_action_id: randomUUID(),
      p_letter_count: 1,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("unknown_hint_type");
  });

  it("charges the entry fee for the puzzle's own difficulty", async () => {
    const { data } = await user.rpc("pay_entry_fee", { p_puzzle_id: puzzleId });
    expect(data.fee).toBe(15);
    expect(data.balance).toBe(485);
  });

  it("does not charge the entry fee twice for the same puzzle", async () => {
    await user.rpc("pay_entry_fee", { p_puzzle_id: puzzleId });
    const { data } = await user.rpc("pay_entry_fee", { p_puzzle_id: puzzleId });
    expect(data.replayed).toBe(true);
    expect(data.fee).toBe(0);
    expect(data.balance).toBe(485);
  });

  it("pays a streak-scaled daily bonus once per day", async () => {
    const first = await user.rpc("claim_daily_bonus");
    expect(first.data.bonus).toBe(25); // 15 + 5 x streak 2
    const second = await user.rpc("claim_daily_bonus");
    expect(second.data.already_claimed).toBe(true);
    expect(second.data.bonus).toBe(0);
  });

  it("rejects a display name that is too short or has bad characters", async () => {
    const short = await user.rpc("set_display_name", { p_name: "a" });
    expect(short.error).not.toBeNull();

    const symbols = await user.rpc("set_display_name", { p_name: "<script>" });
    expect(symbols.error).not.toBeNull();

    const ok = await user.rpc("set_display_name", { p_name: "Sam C" });
    expect(ok.data.display_name).toBe("Sam C");
  });

  it("cannot write users.coins directly", async () => {
    await user.from("users").update({ coins: 999999 }).eq("id", userId);
    // Whether the driver surfaces an error or RLS silently matches zero rows,
    // the balance must be unchanged. That is the property under test.
    const { data } = await admin
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    expect(data!.coins).toBe(500);
  });
});

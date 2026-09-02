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
    });
    expect(error).toBeNull();
    expect(data.cost).toBe(30);
    expect(data.balance).toBe(470);
  });

  
  it("replays a hint action_id without double-charging", async () => {
    const action = randomUUID();
    const a = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_letter",
      p_action_id: action,
    });
    const b = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_letter",
      p_action_id: action,
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
      });
      expect(data.cost).toBe(0);
    }
    const { data } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "check_errors",
      p_action_id: randomUUID(),
    });
    expect(data.cost).toBe(20);
  });

  it("rejects an unknown hint type", async () => {
    const { error } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "free_answers_please",
      p_action_id: randomUUID(),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("unknown_hint_type");
  });

  
  
  it("pays a streak-scaled daily bonus once per day", async () => {
    const first = await user.rpc("claim_daily_bonus");
    expect(first.data.bonus).toBe(40); // 20 + 10 x streak 2
    const second = await user.rpc("claim_daily_bonus");
    expect(second.data.already_claimed).toBe(true);
    expect(second.data.bonus).toBe(0);
  });

  it("pays 20 at streak 0 and caps at 150", async () => {
    await admin
      .from("users")
      .update({ current_streak: 0, last_daily_bonus_date: null })
      .eq("id", userId);
    const base = await user.rpc("claim_daily_bonus");
    expect(base.data.bonus).toBe(20);

    await admin
      .from("users")
      .update({ current_streak: 30, last_daily_bonus_date: null })
      .eq("id", userId);
    const capped = await user.rpc("claim_daily_bonus");
    expect(capped.data.bonus).toBe(150); // min(150, 20 + 300)
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

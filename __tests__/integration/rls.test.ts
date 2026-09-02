import { SupabaseClient } from "@supabase/supabase-js";
import {
  anyPuzzleId,
  createSignedInUser,
  createTestUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("RLS lockdown", () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let otherId: string;

  beforeAll(() => {
    admin = serviceClient();
  });

  beforeEach(async () => {
    const signedIn = await createSignedInUser(admin);
    userId = signedIn.userId;
    user = signedIn.client;
    otherId = await createTestUser(admin);
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
    await admin.auth.admin.deleteUser(otherId);
  });

  it("creates the profile and welcome bonus on signup", async () => {
    const { data } = await admin
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    expect(data!.coins).toBe(300);

    const { data: led } = await admin
      .from("coin_ledger")
      .select("reason, delta")
      .eq("user_id", userId);
    expect(led).toEqual([{ reason: "welcome_bonus", delta: 300 }]);
  });

  it("blocks writing your own coins", async () => {
    await user.from("users").update({ coins: 999999 }).eq("id", userId);
    const { data } = await admin
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    expect(data!.coins).toBe(300); // unchanged
  });

  it("blocks reading another user's row", async () => {
    const { data } = await user.from("users").select("coins").eq("id", otherId);
    expect(data).toEqual([]);
  });

  it("blocks inserting a completion directly", async () => {
    const puzzleId = await anyPuzzleId(admin);
    const { error } = await user.from("puzzle_completions").insert({
      user_id: userId,
      puzzle_id: puzzleId,
      score: 999999,
      time_taken: 1,
      accuracy: 1,
      puzzle_date: "2026-08-15",
      category: "general",
      difficulty: "expert",
      grid_size: 12,
    });
    expect(error).not.toBeNull();

    const { count } = await admin
      .from("puzzle_completions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(0);
  });

  it("exposes only safe leaderboard columns", async () => {
    const { data, error } = await user.rpc("get_leaderboard", { p_limit: 10 });
    expect(error).toBeNull();
    if (data && data.length > 0) {
      expect(Object.keys(data[0]).sort()).toEqual([
        "display_name",
        "puzzles_solved",
        "rank",
        "streak",
        "total_score",
        "user_id",
      ]);
    }
  });

  it("lets a user read their own ledger but not another's", async () => {
    const mine = await user.from("coin_ledger").select("*").eq("user_id", userId);
    expect(mine.error).toBeNull();
    expect((mine.data ?? []).length).toBeGreaterThan(0);

    const theirs = await user
      .from("coin_ledger")
      .select("*")
      .eq("user_id", otherId);
    expect(theirs.data).toEqual([]);
  });

  it("lets anyone read economy config but not write it", async () => {
    const read = await user
      .from("economy_config")
      .select("value")
      .eq("key", "hint_prices")
      .single();
    expect(read.error).toBeNull();
    expect(read.data!.value.reveal_letter).toBe(30);

    await user
      .from("economy_config")
      .update({ value: { reveal_letter: 0 } })
      .eq("key", "hint_prices");

    const { data } = await admin
      .from("economy_config")
      .select("value")
      .eq("key", "hint_prices")
      .single();
    expect(data!.value.reveal_letter).toBe(30); // unchanged
  });
});

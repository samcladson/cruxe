import { SupabaseClient } from "@supabase/supabase-js";
import {
  createSignedInUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("enter_puzzle allowance", () => {
  let admin: SupabaseClient;
  let user: SupabaseClient;
  let userId: string;
  let mediums: string[] = [];
  let dailyChallengeId: string | null = null;

  beforeAll(async () => {
    admin = serviceClient();

    const { data } = await admin
      .from("daily_puzzles")
      .select("id")
      .eq("difficulty", "medium")
      .eq("is_daily_challenge", false)
      .order("puzzle_date", { ascending: false })
      .limit(8);
    mediums = (data ?? []).map((r: any) => r.id);
    if (mediums.length < 6) {
      throw new Error(
        "Need at least 6 medium puzzles in the test database. " +
          "Run scripts/generate-daily-puzzles-free.ts first.",
      );
    }

    const { data: dc } = await admin
      .from("daily_puzzles")
      .select("id")
      .eq("is_daily_challenge", true)
      .order("puzzle_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    dailyChallengeId = dc?.id ?? null;
  });

  beforeEach(async () => {
    const signedIn = await createSignedInUser(admin);
    userId = signedIn.userId;
    user = signedIn.client;
    await admin.from("users").update({ coins: 1000 }).eq("id", userId);
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
  });

  const enter = (puzzleId: string) =>
    user.rpc("enter_puzzle", { p_puzzle_id: puzzleId });

  const FREE_PER_DAY = 5;

  /** Uses up today's free plays on mediums[0..4]. */
  const spendAllowance = async () => {
    for (let i = 0; i < FREE_PER_DAY; i++) await enter(mediums[i]);
  };

  it("grants exactly five free plays per day", async () => {
    const a = await enter(mediums[0]);
    expect(a.data.was_free).toBe(true);
    expect(a.data.cost).toBe(0);
    expect(a.data.free_plays_remaining).toBe(4);

    for (const [i, left] of [[1, 3], [2, 2], [3, 1], [4, 0]]) {
      const r = await enter(mediums[i]);
      expect(r.data.was_free).toBe(true);
      expect(r.data.free_plays_remaining).toBe(left);
    }

    // Balance untouched by free plays
    const { data: row } = await admin
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    expect(row!.coins).toBe(1000);
  });

  it("charges the overflow fee once the allowance is spent", async () => {
    await spendAllowance();

    const overflow = await enter(mediums[5]);
    expect(overflow.error).toBeNull();
    expect(overflow.data.was_free).toBe(false);
    expect(overflow.data.cost).toBe(50); // medium
    expect(overflow.data.balance).toBe(950);
  });

  it("re-entering a started puzzle is always free", async () => {
    await spendAllowance();
    await enter(mediums[5]); // paid 50, balance 950

    const again = await enter(mediums[5]);
    expect(again.data.replayed).toBe(true);
    expect(again.data.cost).toBe(0);
    expect(again.data.balance).toBe(950); // not charged twice
  });

  it("does not charge or consume a slot for the daily challenge", async () => {
    if (!dailyChallengeId) {
      console.warn("No daily challenge row; skipping.");
      return;
    }
    const dc = await enter(dailyChallengeId);
    expect(dc.data.cost).toBe(0);
    expect(dc.data.was_free).toBe(false); // did not use a slot
    expect(dc.data.free_plays_remaining).toBe(5); // untouched

    const first = await enter(mediums[0]);
    expect(first.data.free_plays_remaining).toBe(4);
  });

  it("refuses entry and records nothing when the balance is short", async () => {
    await admin.from("users").update({ coins: 10 }).eq("id", userId);
    await spendAllowance();

    const broke = await enter(mediums[5]);
    expect(broke.error).not.toBeNull();
    expect(broke.error!.message).toContain("insufficient_coins");

    const { count } = await admin
      .from("puzzle_entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("puzzle_id", mediums[5]);
    expect(count).toBe(0);
  });

  it("resets the allowance on a new UTC day", async () => {
    await spendAllowance();

    // Backdate today's entries to simulate the date rolling over.
    await admin
      .from("puzzle_entries")
      .update({ entry_date: "2020-01-01" })
      .eq("user_id", userId);

    const status = await user.rpc("get_play_status");
    expect(status.data.free_plays_remaining).toBe(5);
  });

  it("reports play status without consuming anything", async () => {
    const before = await user.rpc("get_play_status");
    expect(before.data.free_plays_per_day).toBe(5);
    expect(before.data.free_plays_remaining).toBe(5);

    await enter(mediums[0]);

    const after = await user.rpc("get_play_status");
    expect(after.data.free_plays_remaining).toBe(4);
  });
});

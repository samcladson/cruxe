import { SupabaseClient } from "@supabase/supabase-js";
import {
  anyPuzzleId,
  createSignedInUser,
  describeIntegration,
  serviceClient,
} from "./setup";

/** YYYY-MM-DD for `days` before today, UTC — matching the server's clock. */
function utcDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split("T")[0];
}

/**
 * Today, UTC. Used for fixtures that must fall inside the current calendar
 * month: free repairs are counted per month, so "3 days ago" silently lands
 * in the previous month for the first days of any month and the fixture
 * stops representing what it claims.
 */
function utcToday(): string {
  return new Date().toISOString().split("T")[0];
}

describeIntegration("streak repair", () => {
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
    await admin.from("users").update({ coins: 1000 }).eq("id", userId);
  });

  afterEach(async () => {
    await admin.auth.admin.deleteUser(userId);
  });

  /** Puts the account in the state submit_solve leaves after a break. */
  const simulateBreak = (streakWas: number, brokenDaysAgo: number) =>
    admin
      .from("users")
      .update({
        current_streak: 1,
        streak_before_break: streakWas,
        streak_broken_on: utcDaysAgo(brokenDaysAgo),
      })
      .eq("id", userId);

  it("offers no repair when nothing is broken", async () => {
    const { data } = await user.rpc("get_streak_status");
    expect(data.can_repair).toBe(false);
    expect(data.current_streak).toBe(0);
  });

  it("offers a free repair for the first break of the month", async () => {
    await simulateBreak(12, 0);
    const { data } = await user.rpc("get_streak_status");
    expect(data.can_repair).toBe(true);
    expect(data.repair_is_free).toBe(true);
    expect(data.repair_cost).toBe(0);
    expect(data.restores_to).toBe(13); // 12 + today
  });

  it("restores the streak and charges nothing the first time", async () => {
    await simulateBreak(12, 0);
    const { data, error } = await user.rpc("repair_streak");
    expect(error).toBeNull();
    expect(data.streak).toBe(13);
    expect(data.cost).toBe(0);
    expect(data.balance).toBe(1000); // untouched

    const { data: u } = await admin
      .from("users")
      .select("current_streak, longest_streak, streak_broken_on")
      .eq("id", userId)
      .single();
    expect(u!.current_streak).toBe(13);
    expect(u!.longest_streak).toBeGreaterThanOrEqual(13);
    // Cleared, so the prompt disappears and it cannot be repaired twice.
    expect(u!.streak_broken_on).toBeNull();
  });

  it("charges for a second repair in the same month", async () => {
    // A repair already used this month. Must be dated inside the current
    // month, not merely "recent".
    await admin.from("streak_repairs").insert({
      user_id: userId,
      repaired_on: utcToday(),
      restored_to: 5,
      cost: 0,
    });
    await simulateBreak(8, 0);

    const status = await user.rpc("get_streak_status");
    expect(status.data.repair_is_free).toBe(false);
    expect(status.data.repair_cost).toBe(150);

    const { data } = await user.rpc("repair_streak");
    expect(data.cost).toBe(150);
    expect(data.balance).toBe(850);
    expect(data.streak).toBe(9);
  });

  it("refuses a paid repair the player cannot afford", async () => {
    await admin.from("streak_repairs").insert({
      user_id: userId,
      repaired_on: utcToday(),
      restored_to: 4,
      cost: 0,
    });
    await admin.from("users").update({ coins: 20 }).eq("id", userId);
    await simulateBreak(9, 0);

    const { error } = await user.rpc("repair_streak");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("insufficient_coins");

    // Nothing half-applied: the break is still there to repair later.
    const { data: u } = await admin
      .from("users")
      .select("current_streak, streak_broken_on")
      .eq("id", userId)
      .single();
    expect(u!.current_streak).toBe(1);
    expect(u!.streak_broken_on).not.toBeNull();
  });

  it("refuses once the grace window has passed", async () => {
    await simulateBreak(20, 5); // grace_days is 2

    const status = await user.rpc("get_streak_status");
    expect(status.data.can_repair).toBe(false);

    const { error } = await user.rpc("repair_streak");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("repair_window_expired");
  });

  it("refuses when there is no streak worth restoring", async () => {
    await simulateBreak(1, 0); // a 1-day streak is not a loss
    const status = await user.rpc("get_streak_status");
    expect(status.data.can_repair).toBe(false);

    const { error } = await user.rpc("repair_streak");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("no_streak_to_repair");
  });

  it("records what the streak was when submit_solve breaks it", async () => {
    // Played 5 days ago on a 7-day streak, then solves today.
    await admin
      .from("users")
      .update({
        current_streak: 7,
        last_played_date: utcDaysAgo(5),
      })
      .eq("id", userId);

    await admin.rpc("submit_solve", {
      p_user_id: userId,
      p_puzzle_id: puzzleId,
      p_accuracy: 1.0,
      p_time_seconds: 300,
      p_reported_time: 300,
      p_hints_used: 0,
      p_score: 180,
      p_suspect: false,
    });

    const { data: u } = await admin
      .from("users")
      .select("current_streak, streak_before_break, streak_broken_on")
      .eq("id", userId)
      .single();

    expect(u!.current_streak).toBe(1); // reset
    expect(u!.streak_before_break).toBe(7); // remembered
    expect(u!.streak_broken_on).not.toBeNull();

    // ...and is therefore repairable.
    const { data } = await user.rpc("get_streak_status");
    expect(data.can_repair).toBe(true);
    expect(data.restores_to).toBe(8);
  });

  it("does not record a break on a first-ever solve", async () => {
    await admin
      .from("users")
      .update({ current_streak: 0, last_played_date: null })
      .eq("id", userId);

    await admin.rpc("submit_solve", {
      p_user_id: userId,
      p_puzzle_id: puzzleId,
      p_accuracy: 1.0,
      p_time_seconds: 300,
      p_reported_time: 300,
      p_hints_used: 0,
      p_score: 180,
      p_suspect: false,
    });

    const { data: u } = await admin
      .from("users")
      .select("current_streak, streak_broken_on")
      .eq("id", userId)
      .single();
    expect(u!.current_streak).toBe(1);
    expect(u!.streak_broken_on).toBeNull();
  });
});

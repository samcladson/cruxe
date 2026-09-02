import { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import {
  anyPuzzleId,
  createSignedInUser,
  describeIntegration,
  serviceClient,
} from "./setup";

describeIntegration("flat hint pricing", () => {
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

  const hint = (type: string) =>
    user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: type,
      p_action_id: randomUUID(),
    });

  it("charges 120 for a word reveal regardless of word length", async () => {
    const { data, error } = await hint("reveal_word");
    expect(error).toBeNull();
    expect(data.cost).toBe(120);
    expect(data.balance).toBe(880);
  });

  it("still charges 30 for a letter reveal", async () => {
    const { data } = await hint("reveal_letter");
    expect(data.cost).toBe(30);
    expect(data.balance).toBe(970);
  });

  it("records a word reveal as four letters of penalty", async () => {
    await hint("reveal_word");
    const { data } = await admin
      .from("hint_events")
      .select("hint_type, letters_revealed")
      .eq("user_id", userId)
      .single();
    // 120 flat / 30 per letter = 4: you are penalised what you paid for.
    expect(data!.letters_revealed).toBe(4);
  });

  it("rejects the removed letter_count parameter", async () => {
    const { error } = await user.rpc("spend_on_hint", {
      p_puzzle_id: puzzleId,
      p_hint_type: "reveal_word",
      p_action_id: randomUUID(),
      p_letter_count: 1,
    });
    expect(error).not.toBeNull();
  });

  it("keeps five free error checks per puzzle", async () => {
    for (let i = 0; i < 5; i++) {
      const { data } = await hint("check_errors");
      expect(data.cost).toBe(0);
    }
    const { data } = await hint("check_errors");
    expect(data.cost).toBe(20);
  });
});

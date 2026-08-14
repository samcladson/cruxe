/**
 * economyService.ts — The only place the client talks to the economy.
 *
 * Every function here is a thin wrapper over a server-authoritative RPC or
 * Edge Function. The client never computes, sends, or trusts a coin amount.
 * If you find yourself adding arithmetic to this file, it belongs on the
 * server instead.
 */
import { HintPrices } from "../supabase/functions/_shared/economyTypes.ts";
import { supabase } from "./supabaseClient";

export interface HintChargeResult {
  balance: number;
  cost: number;
  replayed: boolean;
}
export interface EntryFeeResult {
  balance: number;
  fee: number;
  replayed: boolean;
}
export interface DailyBonusResult {
  bonus: number;
  streak: number;
  balance: number;
  already_claimed: boolean;
}
export interface SolveResult {
  score: number;
  grade: string;
  coinsEarned: number;
  newBalance: number;
  accuracy: number;
  hintsUsed: number;
  replayed: boolean;
  verified: boolean;
  breakdown: {
    base: number;
    accuracyMultiplier: number;
    timeMultiplier: number;
    hintPenalty: number;
    finalScore: number;
    grade: "S" | "A" | "B" | "C" | "D";
  };
}

/** Turns a Postgres error into something worth showing a player. */
function rpcError(context: string, error: { message: string }): Error {
  const known: Record<string, string> = {
    insufficient_coins: "You don't have enough coins.",
    not_authenticated: "Please sign in again.",
    puzzle_not_found: "That puzzle is no longer available.",
    unknown_hint_type: "That hint isn't available.",
    display_name_length: "Name must be 2–20 characters.",
    display_name_charset:
      "Name can only use letters, numbers, spaces, - and _.",
    display_name_rejected: "Please choose a different name.",
  };
  const key = Object.keys(known).find((k) => error.message.includes(k));
  return new Error(key ? known[key] : `${context} failed. Please try again.`);
}

export async function spendOnHint(
  puzzleId: string,
  hintType: "reveal_letter" | "reveal_word" | "check_errors",
  actionId: string,
  letterCount = 1,
): Promise<HintChargeResult> {
  const { data, error } = await supabase.rpc("spend_on_hint", {
    p_puzzle_id: puzzleId,
    p_hint_type: hintType,
    p_action_id: actionId,
    p_letter_count: letterCount,
  });
  if (error) throw rpcError("Hint", error);
  return data as HintChargeResult;
}

export async function payEntryFee(puzzleId: string): Promise<EntryFeeResult> {
  const { data, error } = await supabase.rpc("pay_entry_fee", {
    p_puzzle_id: puzzleId,
  });
  if (error) throw rpcError("Entry fee", error);
  return data as EntryFeeResult;
}

export async function claimDailyBonus(): Promise<DailyBonusResult> {
  const { data, error } = await supabase.rpc("claim_daily_bonus");
  if (error) throw rpcError("Daily bonus", error);
  return data as DailyBonusResult;
}

export async function setDisplayName(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("set_display_name", {
    p_name: name,
  });
  if (error) throw rpcError("Rename", error);
  return (data as { display_name: string }).display_name;
}

/** Invokes an Edge Function with the caller's session JWT attached. */
async function invoke<T>(
  fn: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export function submitSolve(
  puzzleId: string,
  letters: string,
  clientElapsedSeconds: number,
): Promise<SolveResult> {
  return invoke<SolveResult>("submit-solve", {
    puzzleId,
    letters,
    clientElapsedSeconds,
  });
}

export const syncPurchases = () =>
  invoke<{ credited: number; balance: number }>("sync-purchases", {});

export const deleteAccount = () => invoke<{ ok: boolean }>("delete-account", {});

/**
 * Display-only prices. A charge always uses the server's own number, so a
 * stale or missing value here is cosmetic, never exploitable.
 */
export async function loadHintPrices(): Promise<HintPrices | null> {
  const { data, error } = await supabase
    .from("economy_config")
    .select("value")
    .eq("key", "hint_prices")
    .single();
  if (error || !data) return null;
  return data.value as HintPrices;
}

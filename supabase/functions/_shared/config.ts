import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ScoringConfig, TimeBounds } from "./economyTypes.ts";

/**
 * Reads a single economy_config row. Throws rather than falling back — a
 * server that cannot read its own prices must not award anything.
 */
export async function loadConfig<T>(
  db: SupabaseClient,
  key: string,
): Promise<T> {
  const { data, error } = await db
    .from("economy_config")
    .select("value")
    .eq("key", key)
    .single();
  if (error || !data) throw new Error(`missing_config:${key}`);
  return data.value as T;
}

export const loadScoring = (db: SupabaseClient) =>
  loadConfig<ScoringConfig>(db, "scoring");

export const loadTimeBounds = (db: SupabaseClient) =>
  loadConfig<TimeBounds>(db, "time_bounds");

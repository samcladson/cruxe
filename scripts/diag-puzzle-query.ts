/**
 * diag-puzzle-query.ts — Diagnostic script to debug puzzle retrieval issues.
 *
 * Replicates the exact queries from puzzleService.ts and logs all data
 * the DB actually returns. Run with:
 *   npx tsx scripts/diag-puzzle-query.ts
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 */

import { createClient } from "@supabase/supabase-js";

// Load .env manually since this runs in Node (not Expo)
import { readFileSync } from "fs";
import { join } from "path";

function loadDotEnv() {
  try {
    const envPath = join(process.cwd(), ".env");
    const contents = readFileSync(envPath, "utf-8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.error("Could not load .env:", e);
  }
}

loadDotEnv();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

function getYesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

async function main() {
  const todayUTC = getTodayUTC();
  const yesterdayUTC = getYesterdayUTC();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔍 Cruxe Puzzle Query Diagnostics");
  console.log(`📅 Current UTC time  : ${new Date().toISOString()}`);
  console.log(`📅 Today UTC (query) : ${todayUTC}`);
  console.log(`📅 Yesterday UTC     : ${yesterdayUTC}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── 1. Check what puzzle_dates actually exist in the DB ──────────────
  console.log("1️⃣  All distinct puzzle_dates in DB (most recent 10):");
  const { data: allDates, error: datesErr } = await supabase
    .from("daily_puzzles")
    .select("puzzle_date")
    .order("puzzle_date", { ascending: false })
    .limit(10);

  if (datesErr) {
    console.error("   ❌ Error:", datesErr.message);
  } else {
    const unique = [...new Set((allDates || []).map((r: any) => r.puzzle_date))];
    console.log("   Dates:", unique.length ? unique : "(none)");
  }

  // ── 2. All rows for TODAY ────────────────────────────────────────────
  console.log(`\n2️⃣  All rows for puzzle_date = '${todayUTC}':`);
  const { data: todayRows, error: todayErr } = await supabase
    .from("daily_puzzles")
    .select("id, puzzle_date, category, difficulty, grid_size, variant, is_daily_challenge")
    .eq("puzzle_date", todayUTC);

  if (todayErr) {
    console.error("   ❌ Error:", todayErr.message);
  } else {
    console.log(`   Found: ${todayRows?.length ?? 0} rows`);
    (todayRows || []).forEach((r: any) =>
      console.log(`   → ${r.puzzle_date} | ${r.category} | ${r.difficulty} | ${r.grid_size}x${r.grid_size} | v${r.variant} | daily=${r.is_daily_challenge}`)
    );
  }

  // ── 3. All rows for YESTERDAY ────────────────────────────────────────
  console.log(`\n3️⃣  All rows for puzzle_date = '${yesterdayUTC}':`);
  const { data: yestRows, error: yestErr } = await supabase
    .from("daily_puzzles")
    .select("id, puzzle_date, category, difficulty, grid_size, variant, is_daily_challenge")
    .eq("puzzle_date", yesterdayUTC);

  if (yestErr) {
    console.error("   ❌ Error:", yestErr.message);
  } else {
    console.log(`   Found: ${yestRows?.length ?? 0} rows`);
    (yestRows || []).forEach((r: any) =>
      console.log(`   → ${r.puzzle_date} | ${r.category} | ${r.difficulty} | ${r.grid_size}x${r.grid_size} | v${r.variant} | daily=${r.is_daily_challenge}`)
    );
  }

  // ── 4. Replicate fetchDailyChallenge query for today ─────────────────
  console.log(`\n4️⃣  fetchDailyChallenge query (today, is_daily_challenge=true):`);
  const { data: dc, error: dcErr } = await supabase
    .from("daily_puzzles")
    .select("id, category, difficulty, grid_size, total_words, estimated_time, variant")
    .eq("puzzle_date", todayUTC)
    .eq("is_daily_challenge", true)
    .maybeSingle();
  console.log("   data:", dc, "| error:", dcErr?.message ?? null);

  // ── 5. Replicate fetchDailyChallenge query for yesterday ──────────────
  console.log(`\n5️⃣  fetchDailyChallenge query (yesterday, is_daily_challenge=true):`);
  const { data: dcY, error: dcYErr } = await supabase
    .from("daily_puzzles")
    .select("id, category, difficulty, grid_size, total_words, estimated_time, variant")
    .eq("puzzle_date", yesterdayUTC)
    .eq("is_daily_challenge", true)
    .maybeSingle();
  console.log("   data:", dcY, "| error:", dcYErr?.message ?? null);

  // ── 6. Replicate fetchCategoryPuzzles query for 'general' today ────────
  console.log(`\n6️⃣  fetchCategoryPuzzles query (general, today, is_daily_challenge=false):`);
  const { data: catToday, error: catTodayErr } = await supabase
    .from("daily_puzzles")
    .select("id, category, difficulty, grid_size, variant, total_words, estimated_time")
    .eq("puzzle_date", todayUTC)
    .eq("category", "general")
    .eq("is_daily_challenge", false)
    .order("difficulty")
    .order("grid_size")
    .order("variant");
  console.log(`   Found: ${catToday?.length ?? 0} | error: ${catTodayErr?.message ?? null}`);

  // ── 7. Replicate fetchCategoryPuzzles query for 'general' yesterday ────
  console.log(`\n7️⃣  fetchCategoryPuzzles query (general, yesterday, is_daily_challenge=false):`);
  const { data: catYest, error: catYestErr } = await supabase
    .from("daily_puzzles")
    .select("id, category, difficulty, grid_size, variant, total_words, estimated_time")
    .eq("puzzle_date", yesterdayUTC)
    .eq("category", "general")
    .eq("is_daily_challenge", false)
    .order("difficulty")
    .order("grid_size")
    .order("variant");
  console.log(`   Found: ${catYest?.length ?? 0} | error: ${catYestErr?.message ?? null}`);

  // ── 8. Check total row count (RLS sanity check) ──────────────────────
  console.log(`\n8️⃣  Total row count (RLS sanity check):`);
  const { count, error: countErr } = await supabase
    .from("daily_puzzles")
    .select("*", { count: "exact", head: true });
  console.log(`   Total rows visible to anon key: ${count ?? 0} | error: ${countErr?.message ?? null}`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

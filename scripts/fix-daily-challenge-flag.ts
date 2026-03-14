/**
 * fix-daily-challenge-flag.ts — One-off script to promote existing puzzles.
 *
 * For each distinct puzzle_date in the DB, promotes one puzzle to
 * is_daily_challenge = true (preferring medium difficulty, largest grid).
 *
 * Run once to fix existing data:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/fix-daily-challenge-flag.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

function loadDotEnv() {
  try {
    const contents = readFileSync(join(process.cwd(), ".env"), "utf-8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadDotEnv();

// Service role key needed for UPDATE (RLS requires service_role for writes)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Use service role if available, fall back to anon (anon can't UPDATE due to RLS)
const keyToUse = serviceKey || anonKey;

if (!supabaseUrl || !keyToUse) {
  console.error("❌ Missing Supabase URL or key. Set SUPABASE_SERVICE_ROLE_KEY env var.");
  console.error("   Run: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/fix-daily-challenge-flag.ts");
  process.exit(1);
}

if (!serviceKey) {
  console.warn("⚠️  No SUPABASE_SERVICE_ROLE_KEY found — using anon key (UPDATE may fail due to RLS)");
}

const supabase = createClient(supabaseUrl, keyToUse);

async function main() {
  console.log("\n🔧 Fix Daily Challenge Flag");
  console.log(`   Using ${serviceKey ? "service role" : "anon"} key`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Get all distinct dates
  const { data: allRows, error: fetchErr } = await supabase
    .from("daily_puzzles")
    .select("id, puzzle_date, category, difficulty, grid_size, is_daily_challenge")
    .order("puzzle_date", { ascending: false });

  if (fetchErr || !allRows) {
    console.error("❌ Failed to fetch puzzles:", fetchErr?.message);
    process.exit(1);
  }

  // Group by date
  const byDate = new Map<string, typeof allRows>();
  for (const row of allRows) {
    const date = row.puzzle_date as string;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(row);
  }

  console.log(`Found ${byDate.size} distinct dates:\n`);

  for (const [date, rows] of byDate.entries()) {
    const alreadyHasFlag = rows.some((r: any) => r.is_daily_challenge === true);
    
    if (alreadyHasFlag) {
      const existing = rows.find((r: any) => r.is_daily_challenge === true);
      console.log(`✅ ${date}: already has daily challenge (${existing?.category}/${existing?.difficulty}/${existing?.grid_size}x${existing?.grid_size})`);
      continue;
    }

    // Pick canonical daily challenge: general/medium/10x10 → medium/10 → medium/any → first
    const generalMedium10 = rows.find(
      (r: any) => r.category === "general" && r.difficulty === "medium" && r.grid_size === 10,
    );
    const mediumTen = rows.find((r: any) => r.difficulty === "medium" && r.grid_size === 10);
    const mediumAny = rows.find((r: any) => r.difficulty === "medium");
    const chosen = generalMedium10 ?? mediumTen ?? mediumAny ?? rows[0];

    const { error: updateErr } = await supabase
      .from("daily_puzzles")
      .update({ is_daily_challenge: true })
      .eq("id", chosen.id);

    if (updateErr) {
      console.error(`❌ ${date}: UPDATE failed — ${updateErr.message}`);
      if (updateErr.message.includes("policy")) {
        console.error("   → This is an RLS error. You need SUPABASE_SERVICE_ROLE_KEY env var.");
        console.error("   → Get it from: Supabase Dashboard → Settings → API → service_role secret");
      }
    } else {
      console.log(`🏆 ${date}: promoted ${chosen.category}/${chosen.difficulty}/${chosen.grid_size}x${chosen.grid_size}`);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Done\n");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

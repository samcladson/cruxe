import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { sessionForUser } from "../../scripts/lib/adminAuth";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const anon = process.env.SUPABASE_TEST_ANON_KEY;

export const hasTestEnv = Boolean(url && key && anon);

if (!hasTestEnv) {
  console.warn(
    "\n[integration] Skipped. Set SUPABASE_TEST_URL, " +
      "SUPABASE_TEST_SERVICE_ROLE_KEY and SUPABASE_TEST_ANON_KEY to run these.\n",
  );
}

/** Skips the whole suite with a clear reason when test credentials are absent. */
export const describeIntegration = hasTestEnv ? describe : describe.skip;

export function serviceClient(): SupabaseClient {
  if (!hasTestEnv) throw new Error("Missing SUPABASE_TEST_* env vars");
  return createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const TEST_PASSWORD = "test-password-123";

export function testEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@cruxe.test`;
}

/**
 * Creates a throwaway auth user. Once migration 008 is applied the
 * on_auth_user_created trigger also creates the profile row and the
 * welcome bonus, so callers should not insert a profile themselves.
 */
export async function createTestUser(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email: testEmail(),
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

/**
 * Creates a user and returns an anon-key client already signed in as them.
 * Session comes from scripts/lib/adminAuth, which works around the project's
 * CAPTCHA protection without weakening it.
 */
export async function createSignedInUser(
  db: SupabaseClient,
): Promise<{ userId: string; client: SupabaseClient }> {
  const email = testEmail();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;

  const client = await sessionForUser(db, url!, anon!, email);
  return { userId: data.user!.id, client };
}

export async function deleteTestUser(db: SupabaseClient, id: string) {
  await db.auth.admin.deleteUser(id);
}

/**
 * Picks an existing puzzle of the given difficulty for tests to reference.
 *
 * Prefers a row that has a stored grid, because legacy rows (generated before
 * grid construction moved server-side) have no `clues` array — which would
 * make the reveal_word clamp test pass trivially instead of meaningfully.
 */
export async function anyPuzzleId(
  db: SupabaseClient,
  difficulty = "medium",
): Promise<string> {
  const { data } = await db
    .from("daily_puzzles")
    .select("id, puzzle_data")
    .eq("difficulty", difficulty)
    .order("puzzle_date", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) {
    throw new Error(
      `No ${difficulty} puzzle in the test database. ` +
        "Run scripts/generate-daily-puzzles-free.ts against it first.",
    );
  }

  const withGrid = data.find((r: any) => r.puzzle_data?.grid);
  if (!withGrid) {
    console.warn(
      `[integration] No ${difficulty} puzzle has a stored grid yet; ` +
        "falling back to a legacy row. The reveal_word clamp assertion " +
        "will be weak until the generator has run with grid support.",
    );
  }
  return (withGrid ?? data[0]).id;
}

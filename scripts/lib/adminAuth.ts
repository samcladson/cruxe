/**
 * adminAuth.ts — Gets a real user session for dev tooling, without tripping
 * CAPTCHA.
 *
 * CAPTCHA protection is enabled on this project (it stops scripted
 * anonymous-account minting from polluting the leaderboard), and it covers
 * the password grant endpoint — so `signInWithPassword` fails from any
 * script. Instead we mint a magic-link token with the admin API, which
 * service_role bypasses, and redeem it through `verifyOtp`, which consumes a
 * token rather than issuing one and so is not captcha-gated.
 *
 * Shared by the Jest integration harness and the standalone smoke test.
 * Keep it in one place: these two drifted apart once already, and the
 * failure surfaced as a confusing crash rather than an obvious cause.
 *
 * Dev/test only. Never imported by the app.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns an anon-key client signed in as `email`. The user must already
 * exist — create it with `admin.auth.admin.createUser` first.
 */
export async function sessionForUser(
  admin: SupabaseClient,
  url: string,
  anonKey: string,
  email: string,
): Promise<SupabaseClient> {
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;

  const hashedToken = (link as any)?.properties?.hashed_token;
  if (!hashedToken) {
    throw new Error("generateLink returned no hashed_token");
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Supabase rate-limits the verify endpoint per IP. A suite that signs in
  // once per test hits that ceiling long before it runs out of assertions,
  // and the failure looks like a broken test rather than a throttle.
  let verifyErr = (await client.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  })).error;

  for (let attempt = 1; verifyErr && attempt <= 4; attempt++) {
    if (!/rate limit/i.test(verifyErr.message)) break;
    const wait = 2000 * attempt;
    await new Promise((r) => setTimeout(r, wait));
    verifyErr = (await client.auth.verifyOtp({
      token_hash: hashedToken,
      type: "magiclink",
    })).error;
  }

  if (verifyErr) throw verifyErr;

  return client;
}

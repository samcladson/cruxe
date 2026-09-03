/**
 * authService.ts — Manages Supabase authentication for Cruxe.
 *
 * Uses Supabase anonymous auth so every device gets a real, persistent UUID
 * without requiring the user to sign up. The anonymous session is stored in
 * AsyncStorage and silently restored on subsequent app launches.
 *
 * Anonymous accounts can later be upgraded to Google / Apple sign-in without
 * losing any progress (Supabase links the identities).
 */

import * as Sentry from "@sentry/react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  isAuthApiError,
  isAuthRetryableFetchError,
  Session,
  User,
} from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { usePuzzleStore } from "../stores/puzzleStore";
import { describeIdToken, decodeJwtPayload } from "../utils/jwt";
import { isIdentityAlreadyLinked } from "../utils/identityErrors";
import { pickProviderName, ProviderName } from "../utils/displayName";
import { DEFAULT_DISPLAY_NAME, useUserStore } from "../stores/userStore";
import { deleteAccount, setDisplayName } from "./economyService";
import { drainPendingSolves } from "./offlineSyncService";
import { invalidatePuzzleCache } from "./puzzleService";
import { reportError } from "./errorReporting";
import { supabase } from "./supabaseClient";
import { loginToRevenueCat, logoutRevenueCat } from "./revenueCatService";

// ─── Google Sign-In — Web OAuth client (same Google Cloud project as Android/iOS) ─
// For Android, also create an *Android* OAuth client with:
//   package: com.cruxe.app  +  SHA-1 of your debug (or release) keystore
//   https://react-native-google-signin.github.io/docs/troubleshooting
/**
 * The WEB client id — not the Android one. Google Sign-In on Android
 * authenticates with the web client and uses the Android client only to
 * verify the package name and signing key.
 *
 * The fallback below is a convenience that has hidden a real failure mode:
 * if it belongs to a different Google Cloud project than your Android OAuth
 * clients, every sign-in fails with DEVELOPER_ERROR and nothing says why.
 * Set the env var explicitly.
 */
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "1042059769347-31fuo35i64l5l0ap3tgt47t2v33k0t59.apps.googleusercontent.com";

if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
  console.warn(
    "[Auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — using the " +
      `hardcoded fallback (project ${GOOGLE_WEB_CLIENT_ID.split("-")[0]}). ` +
      "Your Android OAuth clients must live in that same Google Cloud " +
      "project or sign-in fails with DEVELOPER_ERROR.",
  );
}

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: true,
});

// ─── Types ───────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  session: Session | null;
  isInitialised: boolean;
}

// ─── Init ────────────────────────────────────────────────────────────

/**
 * Initialises authentication on app launch.
 *
 * Flow:
 *  1. Attempt to restore existing session from AsyncStorage.
 *  2. If no session exists (first install, or cleared storage):
 *     sign in anonymously and create a new user.
 *  3. Return the authenticated user so the calling code can hydrate
 *     the userStore and create the DB profile row if needed.
 *
 * Always resolves — never throws so the app can still function
 * in degraded mode if Supabase is unreachable.
 */
export async function initAuth(): Promise<AuthState> {
  try {
    // First check if we already have a valid session in AsyncStorage
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session) {
      const status = await checkAccountStillExists();

      if (status === "gone") {
        // The account behind this session no longer exists: deleted on
        // another device, removed by support, or deleted here in a run that
        // was killed before the local teardown finished. Whatever the cause,
        // the stored session is void and the local profile describes someone
        // who is not coming back.
        console.warn(
          "[Auth] Stored session belongs to a deleted account — clearing it.",
        );
        await supabase.auth.signOut({ scope: "local" }).catch(() => {
          /* The remote session is already gone; only storage matters. */
        });
        await clearLocalIdentity();
        // Falls through to the anonymous sign-in below.
      } else {
        // "exists" or "unknown". Unknown means the check itself could not
        // reach the server, which is not evidence of anything — treating an
        // offline launch as a deleted account would destroy a real player's
        // progress, so the session is kept and revalidated next launch.
        console.log(
          "[Auth] Restored existing session for user:",
          sessionData.session.user.id,
        );
        return {
          user: sessionData.session.user,
          session: sessionData.session,
          isInitialised: true,
        };
      }
    }

    // No session — sign in anonymously (first launch)
    console.log("[Auth] No session found, signing in anonymously...");
    const { data: anonData, error: anonError } =
      await supabase.auth.signInAnonymously();

    if (anonError || !anonData.user) {
      console.error("[Auth] Anonymous sign-in failed:", anonError?.message);
      if (anonError?.message?.toLowerCase().includes("captcha")) {
        // Supabase CAPTCHA protection covers the signup endpoint, and
        // signInAnonymously IS a signup. With it enabled, no new user can
        // ever get a session - the app silently degrades to local-only and
        // nothing saves. Anonymous-first auth and CAPTCHA are incompatible.
        console.error(
          "[Auth] CAPTCHA is enabled on this Supabase project. It blocks " +
            "anonymous sign-in, so no new install can create an account. " +
            "Disable it under Authentication > Settings, or every fresh " +
            "install will be broken.",
        );
      }
      return { user: null, session: null, isInitialised: true };
    }

    console.log("[Auth] Anonymous sign-in successful:", anonData.user.id);
    return {
      user: anonData.user,
      session: anonData.session,
      isInitialised: true,
    };
  } catch (err) {
    console.error("[Auth] initAuth failed unexpectedly:", err);
    // Degrading to local-only is deliberate, but it should never happen
    // quietly — every fresh install depends on this path succeeding.
    reportError("auth", err);
    return { user: null, session: null, isInitialised: true };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Whether the account behind the stored session still exists on the server.
 *
 * A session restored from AsyncStorage is only a cached token — it says
 * nothing about whether the account survived. `getUser()` asks the server,
 * and the three-way answer matters enormously:
 *
 *  - "gone"    the server actively rejected the token's subject. Safe to wipe.
 *  - "unknown" we could not reach the server, or the failure was not about
 *              identity. NOT evidence of deletion. Treating this as "gone"
 *              would erase the local profile of every player who opens the
 *              app on a plane.
 *  - "exists"  confirmed.
 *
 * The default on any unrecognised failure is "unknown", because the cost of
 * a wrong "gone" is destroyed player data and the cost of a wrong "unknown"
 * is one more launch before the session is cleaned up.
 */
type AccountStatus = "exists" | "gone" | "unknown";

async function checkAccountStillExists(): Promise<AccountStatus> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (data?.user) return "exists";

    if (!error) return "unknown";

    // A transient fetch failure is the offline case, never a deletion.
    if (isAuthRetryableFetchError(error)) return "unknown";

    // GoTrue answers a token whose subject no longer exists with 401/403.
    // 404 covers the user-not-found shape some versions return.
    if (isAuthApiError(error)) {
      const status = error.status ?? 0;
      const definitive =
        status === 401 ||
        status === 403 ||
        status === 404 ||
        /user.*not.*found|user from sub claim/i.test(error.message);
      return definitive ? "gone" : "unknown";
    }

    return "unknown";
  } catch (e) {
    // Never let this throw into bootstrap: an unusable answer is "unknown".
    console.warn("[Auth] Could not verify the stored session:", e);
    return "unknown";
  }
}

/**
 * Returns the current authenticated user's UUID, or null if unauthenticated.
 * This is the canonical userId used in all Supabase writes.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Returns the current session (or null). Prefer this over a fake "sync" helper —
 * the Supabase client has no safe synchronous session read in JS.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn("[Auth] getCurrentSession:", error.message);
    return null;
  }
  return data.session ?? null;
}

/**
 * Subscribes to auth state changes.
 * Used in _layout.tsx to react to token refreshes and sign-out events.
 *
 * @returns Unsubscribe function to call on component unmount
 */
export function onAuthStateChange(
  callback: (user: User | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// ─── Profile Row ─────────────────────────────────────────────────────
//
// There is no ensureUserProfile here any more. The profile row and the
// welcome bonus are created together by the on_auth_user_created trigger
// (migration 008), inside one transaction. Doing it client-side meant the
// welcome bonus could be re-farmed by clearing app storage, and the client
// no longer has INSERT rights on `users` regardless.

// ─── Display name ────────────────────────────────────────────────────

/**
 * Adopts the name Google or Apple gave us as the player's display name.
 *
 * The signup trigger names every account 'Player' because an anonymous user
 * has no name to offer. Linking a social account is the first moment a real
 * one exists, and nothing was carrying it across — so every signed-in player
 * stayed "Player" forever. The client cannot UPDATE `users` (migration 008),
 * so this goes through the set_display_name RPC.
 *
 * Only the untouched 'Player' default is replaced; a name the player already
 * has is never overwritten. Callers may pass the name straight from the
 * provider SDK — with none, the current session's user metadata is used, which
 * is what backfills accounts linked before this existed.
 *
 * Cosmetic, so it never throws: a failure here must not fail a sign-in.
 */
export async function adoptProviderDisplayName(
  candidate?: ProviderName,
): Promise<string | null> {
  try {
    const store = useUserStore.getState();
    if (store.profile.displayName !== DEFAULT_DISPLAY_NAME) return null;

    let name = candidate ? pickProviderName(candidate) : null;

    if (!name) {
      const { data } = await supabase.auth.getUser();
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      name = pickProviderName({
        full: (meta.full_name ?? meta.name) as string | undefined,
        given: meta.given_name as string | undefined,
      });
    }

    // An anonymous user has no provider name, so this is where they stop.
    if (!name) return null;

    const saved = await setDisplayName(name);
    store.setDisplayName(saved);
    console.log("[Auth] Adopted display name from social provider");
    return saved;
  } catch (err) {
    console.warn("[Auth] Could not adopt provider display name:", err);
    return null;
  }
}

// ─── Social Logins ───────────────────────────────────────────────────

/**
 * Points the app at an account that already existed, replacing whatever
 * anonymous one this device was carrying.
 *
 * `setUserId` clears the previous profile because the id changed, so the
 * throwaway anonymous state cannot bleed into the real account. The puzzle
 * cache is dropped for the same reason: its completion flags belong to the
 * session being left behind.
 */
async function rebindToAccount(userId: string): Promise<void> {
  try {
    invalidatePuzzleCache();
  } catch (e) {
    console.warn("[Auth] Could not clear the puzzle cache:", e);
  }
  useUserStore.getState().setUserId(userId);
  await loginToRevenueCat(userId);
  await useUserStore.getState().syncFromSupabase(userId);
}

export interface SocialAuthResult {
  error: Error | null;
  user?: User;
  /** True when an existing account was signed into rather than upgraded. */
  signedIntoExisting?: boolean;
}

/**
 * Attaches a provider identity to this device's session — by linking it to
 * the current anonymous account, or by signing into the account that already
 * owns it.
 *
 * Only the first half of that used to exist, and it made returning
 * impossible. Signing out leaves the previous account intact and starts a
 * fresh anonymous one, so the identity is still attached to the old user;
 * every later attempt to link it failed with "Identity is already linked to
 * another user" and there was no path back into your own account. Deleting
 * an account had the same effect whenever an earlier sign-out had left an
 * orphaned account holding the identity.
 *
 * So: link if the identity is new — that upgrades a guest account and keeps
 * the progress it earned — and sign in if it is not, which is a returning
 * player asking for the account they already have.
 */
async function linkOrSignIn(
  provider: "google" | "apple",
  token: string,
  nonce?: string,
): Promise<SocialAuthResult> {
  const linked = await supabase.auth.linkIdentity({ provider, token, nonce });

  if (!linked.error) {
    return { error: null, user: linked.data.user ?? undefined };
  }

  if (!isIdentityAlreadyLinked(linked.error)) {
    return { error: linked.error };
  }

  console.log(
    `[Auth] ${provider} identity belongs to an existing account — signing ` +
      "into it rather than linking.",
  );

  const signedIn = await supabase.auth.signInWithIdToken({
    provider,
    token,
    nonce,
  });

  if (signedIn.error) return { error: signedIn.error };

  const user = signedIn.data.user;
  if (!user) {
    return { error: new Error("Signed in but no user was returned.") };
  }

  // The anonymous account this device was using is now abandoned. Nothing
  // here can delete it — the client has no such privilege — and it holds no
  // progress worth keeping, since the player just chose a different account.
  await rebindToAccount(user.id);

  return { error: null, user, signedIntoExisting: true };
}



/**
 * Initiates native Apple Sign-In and links it to the current Supabase session.
 * Uses a crypto nonce to prevent replay attacks per Apple guidelines.
 */
export async function linkAppleAccount(): Promise<SocialAuthResult> {
  try {
    const rawNonce = Math.random().toString(36).substring(2, 10);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error("No identityToken returned from Apple Sign In");
    }

    // Link if new to us, otherwise sign into the account that owns this
    // Apple identity. The nonce must match the one inside the token.
    const { error, user, signedIntoExisting } = await linkOrSignIn(
      "apple",
      credential.identityToken,
      rawNonce,
    );

    if (error) throw error;

    console.log(
      signedIntoExisting
        ? "[Auth] Signed into an existing Apple account"
        : "[Auth] Successfully linked Apple account",
    );

    // Apple returns the name in the credential on the FIRST authorisation
    // only, and never in the identity token. If we do not take it here, it
    // is gone for good.
    await adoptProviderDisplayName({
      full: [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" "),
      given: credential.fullName?.givenName,
    });

    return { error: null, user, signedIntoExisting };
  } catch (error: any) {
    if (error.code === "ERR_REQUEST_CANCELED") {
      console.log("[Auth] Apple Sign-In canceled by user");
      return { error: null }; // Silent cancel
    }
    console.error("[Auth] Apple Sign-In error:", error);
    return { error };
  }
}


/**
 * Initiates native Google Sign-In and links it to the current Supabase session.
 */
export async function linkGoogleAccount(): Promise<SocialAuthResult> {
  try {
    await GoogleSignin.hasPlayServices();

    // Clear the SDK's cached account first so the chooser always appears.
    // Without this, signIn() resolves silently with whoever signed in last,
    // and a player with two Google accounts has no way to reach the other
    // one. Tapping "Continue with Google" is a deliberate act — the choice
    // belongs to the player, not to whatever the SDK happens to remember.
    try {
      if (GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.signOut();
      }
    } catch (e) {
      // Not fatal: at worst the chooser is skipped, which is the old
      // behaviour rather than a failure.
      console.warn("[Auth] Could not clear the cached Google account:", e);
    }

    const response = await GoogleSignin.signIn();

    // google-signin v11+ uses a response object with type and data
    let idToken: string | null = null;

    if ((response as any).type === "success") {
      idToken = (response as any).data?.idToken;
    } else if ((response as any).idToken) {
      // Fallback for older package versions
      idToken = (response as any).idToken;
    } else {
      console.log("[Auth] Google Sign-In not successful (type !== success)");
      return { error: null };
    }

    if (!idToken) {
      throw new Error("No ID token returned from Google Sign In");
    }

    // GoTrue reports a token it cannot use as "invalid claim: missing sub
    // claim", which names a symptom rather than the cause. Check here, where
    // we still know what we sent and can say so.
    const claims = decodeJwtPayload(idToken);
    if (!claims || !claims.sub) {
      console.warn(
        [
          "[Auth] The Google ID token is unusable before Supabase sees it.",
          `       ${describeIdToken(idToken)}`,
          `       aud must equal the web client id in use (${GOOGLE_WEB_CLIENT_ID}).`,
        ].join("\n"),
      );
      throw new Error(
        "Google returned a token without a subject claim. Check that " +
          "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is the Web client id from the " +
          "same Google Cloud project as this build's Android OAuth client.",
      );
    }

    if (claims.aud && claims.aud !== GOOGLE_WEB_CLIENT_ID) {
      // Supabase matches the token's audience against its configured client
      // ids. A mismatch is a configuration error, not a credentials one.
      console.warn(
        "[Auth] The Google ID token's audience is not the client id this " +
          "build configured. Supabase will reject it unless that audience " +
          "is listed under Authentication > Providers > Google > Authorized " +
          "Client IDs.",
      );
    }

    // Link if this identity is new to us, sign in if it already belongs to
    // an account — a returning player is asking for the account they have.
    const { error, user, signedIntoExisting } = await linkOrSignIn(
      "google",
      idToken,
    );

    if (error) {
      // Claim errors mean the token itself was wrong, not the credentials.
      // Say what we actually sent, or this is unfalsifiable guesswork.
      if (/claim|token/i.test(error.message)) {
        console.warn(
          `[Auth] Supabase rejected the Google ID token: ${error.message}\n` +
            `       ${describeIdToken(idToken)}\n` +
            `       aud should equal the web client id in use ` +
            `(${GOOGLE_WEB_CLIENT_ID}).\n` +
            "       If it does, check Supabase Dashboard > Authentication >" +
            " Providers > Google: the provider must be enabled and that same" +
            " client id listed under Authorized Client IDs.",
        );
      }
      throw error;
    }

    console.log(
      signedIntoExisting
        ? "[Auth] Signed into an existing Google account"
        : "[Auth] Successfully linked Google account",
    );

    // Taken from the Google SDK response rather than Supabase's merged user
    // metadata, which is the more reliable of the two. A returning account
    // already has its name — adoptProviderDisplayName only ever replaces the
    // untouched 'Player' default, so this is a no-op for them.
    const googleUser =
      (response as any).data?.user ?? (response as any).user ?? {};
    await adoptProviderDisplayName({
      full: googleUser.name,
      given: googleUser.givenName,
    });

    return { error: null, user, signedIntoExisting };
  } catch (error: any) {
    if (
      error.code === "ASYNC_OP_IN_PROGRESS" ||
      error.code === "SIGN_IN_CANCELLED"
    ) {
      console.log("[Auth] Google Sign-In canceled or already in progress");
      return { error: null }; // Silent cancel
    }
    if (error?.code === "DEVELOPER_ERROR") {
      const pkg = Constants.expoConfig?.android?.package ?? "com.cruxe.app";
      const project = GOOGLE_WEB_CLIENT_ID.split("-")[0];
      console.warn(
        [
          "[Auth] DEVELOPER_ERROR means Google does not recognise this",
          "package + signing-key pair. Check, in order:",
          `  1. An Android OAuth client exists for package "${pkg}" with the`,
          "     SHA-1 of the key signing THIS build. Get it with",
          "     scripts/print-android-debug-sha1.cmd. Note that",
          "     'expo prebuild --clean' regenerates the debug keystore and",
          "     therefore changes the SHA-1.",
          "  2. That Android client is in the SAME Google Cloud project as",
          `     the web client in use (project ${project}).`,
          "  3. Release builds are signed with a different key again, and",
          "     need their own Android OAuth client.",
        ].join("\n"),
      );
      return { error };
    }
    console.error("[Auth] Google Sign-In error:", error);
    return { error };
  }
}

// ─── Linked providers & sign-out ─────────────────────────────────────

export interface LinkedProviders {
  hasGoogle: boolean;
  hasApple: boolean;
}

/**
 * Returns which OIDC providers are linked on the current Supabase user.
 */
export async function getLinkedProviders(): Promise<LinkedProviders> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.identities) {
    return { hasGoogle: false, hasApple: false };
  }
  const idents = data.user.identities;
  return {
    hasGoogle: idents.some((i) => i.provider === "google"),
    hasApple: idents.some((i) => i.provider === "apple"),
  };
}

/**
 * How long the pre-sign-out solve flush may take before it is abandoned.
 * Generous enough for a slow connection, short enough that a dead one does
 * not look like a frozen app.
 */
const DRAIN_TIMEOUT_MS = 8000;

/**
 * Rejects if `work` has not settled within `ms`.
 *
 * The underlying promise is not cancelled — nothing here can cancel a
 * request in flight — it is simply no longer waited on. That is the point:
 * a hung network call must not be able to hold a destructive flow open.
 */
function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timed out after ${ms}ms while ${label}`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Serialises the destructive flows against themselves.
 *
 * Sign-out and deletion both tear down the same state, and a second call
 * arriving while the first is mid-teardown would race it — deleting an
 * account twice, or wiping a freshly created anonymous session. The UI
 * disables its buttons, but a guard here is what actually makes that true.
 */
let destructiveFlowInFlight: Promise<unknown> | null = null;

function runExclusively<T>(work: () => Promise<T>): Promise<T> | null {
  if (destructiveFlowInFlight) return null;
  const promise = work().finally(() => {
    destructiveFlowInFlight = null;
  });
  destructiveFlowInFlight = promise;
  return promise;
}

/**
 * Erases every trace of the current identity from this device and process.
 *
 * Both sign-out and account deletion need exactly this, and when they each
 * had their own version they drifted: deletion never logged RevenueCat out
 * and neither cleared Sentry or the puzzle cache, so a deleted account's UUID
 * kept riding along on crash reports and its solved-puzzle flags stayed
 * readable in memory. One function, called by both, cannot drift again.
 *
 * Every step is best-effort and independent — a failure in one must not
 * abandon the rest half-done, which would leave a partly-erased identity.
 */
async function clearLocalIdentity(): Promise<void> {
  // Stop attributing crashes to a user who no longer exists here.
  try {
    Sentry.setUser(null);
  } catch (e) {
    console.warn("[Auth] Could not clear the Sentry user:", e);
  }

  // Detach the RevenueCat SDK from this app_user_id, or a later purchase is
  // attributed to the account just left behind.
  try {
    await logoutRevenueCat();
  } catch (e) {
    console.warn("[Auth] RevenueCat logout failed:", e);
  }

  // The Google SDK keeps its own record of who signed in, entirely separate
  // from the Supabase session. Leaving it meant the next sign-in silently
  // reused the same account with no chooser — so after signing out you could
  // not pick a different one, and it looked like the app had never logged out
  // at all. signOut() forgets the account; revokeAccess() would also drop the
  // OAuth grant and force the consent screen again, which is more than
  // signing out should do.
  try {
    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }
  } catch (e) {
    console.warn("[Auth] Google SDK sign-out failed:", e);
  }

  // Per-user completion flags live here, and one key is not user-scoped, so
  // the next account in this process would read the previous one's progress.
  try {
    invalidatePuzzleCache();
  } catch (e) {
    console.warn("[Auth] Could not clear the puzzle cache:", e);
  }

  // Guarded like everything above: a throw here would skip the step after
  // it and leave exactly the half-erased device this function exists to
  // prevent. These are the two that matter most, so they fail loudly.
  try {
    useUserStore.getState().resetLocalProfile();
  } catch (e) {
    console.error("[Auth] Could not reset the local profile:", e);
    reportError("auth", e);
  }

  try {
    usePuzzleStore.getState().clearActivePuzzle();
  } catch (e) {
    console.error("[Auth] Could not clear the active puzzle:", e);
    reportError("auth", e);
  }
}

/**
 * Starts a fresh anonymous session and hydrates the stores from it.
 *
 * Shared by sign-out and deletion: in both cases the app must be immediately
 * usable, and every economy RPC needs a JWT. Returns a message on failure.
 */
async function startAnonymousSession(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    const msg = error?.message ?? "";
    if (msg.toLowerCase().includes("captcha")) {
      return {
        error:
          "Couldn't start a new session. CAPTCHA protection is blocking " +
          "anonymous sign-in on this project — it needs to be disabled in " +
          "Supabase Authentication settings.",
      };
    }
    return { error: msg || "Could not start a new session" };
  }

  const userId = data.user.id;
  useUserStore.getState().setUserId(userId);
  await loginToRevenueCat(userId);
  await useUserStore.getState().syncFromSupabase(userId);

  // A fresh account must read as a fresh account. Anything non-zero here
  // besides the welcome bonus means state from the previous identity
  // survived, which is invisible in the UI until a player reports their old
  // streak following them onto a new account.
  const fresh = useUserStore.getState().profile;
  console.log(
    `[Auth] New anonymous session ${userId} — coins=${fresh.coins} ` +
      `streak=${fresh.currentStreak} solved=${fresh.totalPuzzlesSolved} ` +
      `name=${fresh.displayName}`,
  );
  if (fresh.currentStreak !== 0 || fresh.totalPuzzlesSolved !== 0) {
    console.warn(
      "[Auth] A new account came up with a non-zero streak or solve count. " +
        "That is carried-over state from the previous identity, not server " +
        "data — the users row for a new account is NOT NULL DEFAULT 0.",
    );
  }

  return { error: null };
}

/**
 * Signs out of Supabase, clears local state, and establishes a new anonymous
 * session so the user can keep playing without a full reinstall.
 *
 * The server call goes first on purpose. Wiping local state up front meant a
 * failed sign-out left the user still signed in with their progress already
 * destroyed — an error message on top of unrecoverable data loss.
 */
export async function signOutAndStartNewAnonSession(): Promise<{
  error: string | null;
}> {
  const run = runExclusively(() => signOutInner());
  if (!run) {
    // A destructive flow is already running. Reporting success would be a
    // lie and reporting an error would be alarming, so say what is true.
    return { error: "Already signing out. Give it a moment." };
  }
  return run;
}

async function signOutInner(): Promise<{ error: string | null }> {
  try {
    // Solves finished offline belong to the account being left. Once the
    // session is gone they can never be submitted, so this is the last
    // chance. Bounded, because a stalled request must not strand the user
    // on a spinner in a flow they can no longer cancel.
    try {
      await withTimeout(
        drainPendingSolves(),
        DRAIN_TIMEOUT_MS,
        "flushing pending solves",
      );
    } catch (e) {
      console.warn("[Auth] Could not flush pending solves before sign-out:", e);
    }

    const { error: signOutErr } = await supabase.auth.signOut();
    if (signOutErr) {
      // Nothing local has been touched yet, so the user is exactly where
      // they were and can retry.
      return { error: signOutErr.message };
    }

    await clearLocalIdentity();
    return await startAnonymousSession();
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Sign out failed",
    };
  }
}

export interface DeleteAccountResult {
  /**
   * True once the server has destroyed the account — including when a later
   * step failed. Callers must branch on this rather than on `error`, because
   * "deleted, but the new session failed" still means the account is gone and
   * the device state must be torn down.
   */
  accountDeleted: boolean;
  error: string | null;
}

/**
 * Permanently deletes the account, then returns the app to a first-run state.
 *
 * Ordering is the whole point here:
 *
 *  1. The server delete runs first. If it fails, nothing local is touched and
 *     the caller can report an honest failure.
 *  2. Once it succeeds the account is gone, so the local teardown is
 *     unconditional. The previous version bailed out of the wipe if
 *     `signOut()` threw, leaving a deleted account's data sitting on the
 *     device behind a session pointing at a user that no longer exists.
 *  3. A new anonymous session is established. Without one the app had no JWT
 *     at all: the player could walk from the welcome screen into the tabs and
 *     every economy call would fail with not_authenticated until they killed
 *     and relaunched the app.
 *
 * The caller still resets onboarding flags and cancels notifications — those
 * are device concerns rather than identity, and live with the UI.
 */
export async function deleteAccountAndReset(): Promise<DeleteAccountResult> {
  const run = runExclusively(() => deleteAccountInner());
  if (!run) {
    // Never let a second delete start: the first may already have destroyed
    // the account, and the second would report a confusing failure for it.
    return {
      accountDeleted: false,
      error: "A deletion is already in progress. Give it a moment.",
    };
  }
  return run;
}

async function deleteAccountInner(): Promise<DeleteAccountResult> {
  try {
    // Throws on failure, which is what we want: no local data is destroyed
    // unless the server confirms the account is gone.
    await deleteAccount();
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Could not delete account";

    // A thrown call is not proof the account survived. The request may have
    // been carried out and only the response lost — a dropped connection, a
    // backgrounded app, a gateway timeout. Asking the server settles it, and
    // without this the account would be gone while the device kept every
    // trace of it, with the app insisting the deletion had failed.
    const status = await checkAccountStillExists();

    if (status !== "gone") {
      // "exists" means the account is genuinely still there; "unknown" means
      // we could not find out, and destroying local data on a guess is not a
      // trade worth making. Both keep the user where they are.
      console.warn(`[Auth] Account deletion failed (account ${status}):`, reason);
      return { accountDeleted: false, error: reason };
    }

    console.warn(
      "[Auth] The delete call failed but the account is gone — " +
        "completing the local teardown.",
    );
  }

  // Past the point of no return. Everything below runs regardless of
  // individual failures — a half-erased device is the worst outcome.
  try {
    await supabase.auth.signOut();
  } catch (e) {
    // The user is deleted, so the session is already dead server-side.
    console.warn("[Auth] signOut after deletion failed (session is void):", e);
  }

  await clearLocalIdentity();

  // startAnonymousSession can reject as well as return an error — a throw
  // from the profile hydration inside it, say. Letting that escape would
  // reject this whole call after the account was already destroyed, and the
  // caller's spinner would never come down. It resolves, always.
  let sessionError: string | null;
  try {
    sessionError = (await startAnonymousSession()).error;
  } catch (e) {
    sessionError = e instanceof Error ? e.message : "unexpected failure";
  }

  if (sessionError) {
    // The deletion itself succeeded; only the fresh session did not. Callers
    // key off `accountDeleted`, never off the wording of this message.
    return {
      accountDeleted: true,
      error:
        "Your account was deleted, but a new guest session could not be " +
        `started: ${sessionError}. Restart the app to continue.`,
    };
  }
  return { accountDeleted: true, error: null };
}

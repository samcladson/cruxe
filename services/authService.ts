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

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Session, User } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { usePuzzleStore } from "../stores/puzzleStore";
import { useUserStore } from "../stores/userStore";
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
    return { user: null, session: null, isInitialised: true };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

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

// ─── Social Logins (Linking) ─────────────────────────────────────────

/**
 * Initiates native Apple Sign-In and links it to the current Supabase session.
 * Uses a crypto nonce to prevent replay attacks per Apple guidelines.
 */
export async function linkAppleAccount(): Promise<{
  error: Error | null;
  user?: User;
}> {
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

    // Link the Apple identity to the existing anonymous user (nonce must match the token)
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) throw error;

    console.log("[Auth] Successfully linked Apple account");
    return { error: null, user: data.user };
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
export async function linkGoogleAccount(): Promise<{
  error: Error | null;
  user?: User;
}> {
  try {
    await GoogleSignin.hasPlayServices();
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

    // Link the Google identity to the existing anonymous user
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      token: idToken,
    });

    if (error) throw error;

    console.log("[Auth] Successfully linked Google account");
    return { error: null, user: data.user };
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
 * Signs out of Supabase, clears local play state, and establishes a new
 * anonymous session so the user can keep playing without a full reinstall.
 */
export async function signOutAndStartNewAnonSession(): Promise<{
  error: string | null;
}> {
  try {
    useUserStore.getState().resetLocalProfile();
    usePuzzleStore.getState().clearActivePuzzle();

    const { error: signOutErr } = await supabase.auth.signOut();
    if (signOutErr) {
      return { error: signOutErr.message };
    }
    await logoutRevenueCat();

    const { data, error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError || !data.user) {
      const msg = anonError?.message ?? "";
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
    return { error: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Sign out failed",
    };
  }
}

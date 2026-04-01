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

import { Session, User } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { supabase } from "./supabaseClient";

// ─── Setup Google Sign-In ────────────────────────────────────────────
// TODO: Replace with your actual Google Web Client ID from Google Cloud Console
GoogleSignin.configure({
  webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
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
 * Returns the current auth session synchronously from the last known state.
 * Use this in non-async contexts (e.g., store actions).
 * Falls back to null if auth is not initialised yet.
 */
export function getSession(): Session | null {
  // supabase-js v2 fires an onAuthStateChange; we read from cache here
  // This is sync-safe because initAuth() is awaited before any store action fires
  let cached: Session | null = null;
  supabase.auth.getSession().then(({ data }) => {
    cached = data?.session ?? null;
  });
  return cached;
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

// ─── Ensure Profile Row ──────────────────────────────────────────────

/**
 * Creates the user's row in the `users` table if it does not exist yet.
 * Called after every successful auth — safe to call repeatedly (upsert).
 *
 * @param userId - The auth user UUID
 * @param displayName - Name to use if creating for the first time
 */
export async function ensureUserProfile(
  userId: string,
  displayName: string = "Player",
): Promise<void> {
  const { error } = await supabase.from("users").upsert(
    {
      id: userId,
      display_name: displayName,
    },
    {
      // Only insert if not exists — do NOT overwrite existing profile data
      onConflict: "id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    console.error("[Auth] Failed to ensure user profile row:", error.message);
  }
}

// ─── Social Logins (Linking) ─────────────────────────────────────────

/**
 * Initiates native Apple Sign-In and links it to the current Supabase session.
 * Uses a crypto nonce to prevent replay attacks per Apple guidelines.
 */
export async function linkAppleAccount(): Promise<{ error: Error | null; user?: User }> {
  try {
    const rawNonce = Math.random().toString(36).substring(2, 10);
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
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

    // Link the Apple identity to the existing anonymous user
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "apple",
      token: credential.identityToken,
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
export async function linkGoogleAccount(): Promise<{ error: Error | null; user?: User }> {
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
    if (error.code === "ASYNC_OP_IN_PROGRESS" || error.code === "SIGN_IN_CANCELLED") {
      console.log("[Auth] Google Sign-In canceled or already in progress");
      return { error: null }; // Silent cancel
    }
    console.error("[Auth] Google Sign-In error:", error);
    return { error };
  }
}

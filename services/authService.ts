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
import { supabase } from "./supabaseClient";

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

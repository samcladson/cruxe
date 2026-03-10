import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for the Cruxe app.
 *
 * Uses the public anon key for client-side operations.
 * All sensitive operations (puzzle generation, admin tasks) happen
 * server-side in Edge Functions using the service_role key.
 *
 * Auth sessions are persisted to AsyncStorage so users remain
 * authenticated across app restarts and device reboots.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in environment variables",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session to AsyncStorage so anonymous users keep their
    // identity across restarts without signing in again.
    storage: AsyncStorage,
    persistSession: true,
    // Automatically refresh tokens before they expire
    autoRefreshToken: true,
    // Detect session from URL (needed for OAuth redirect flows later)
    detectSessionInUrl: false,
  },
});

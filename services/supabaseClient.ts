import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for the Cruxe app.
 *
 * Uses the public anon key for client-side operations.
 * All sensitive operations (puzzle generation, admin tasks) happen
 * server-side in Edge Functions using the service_role key.
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
    // Using AsyncStorage for session persistence in React Native
    // TODO: Wire up expo-secure-store for production auth
    persistSession: false,
  },
});

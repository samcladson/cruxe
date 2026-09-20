import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabaseClient";
import { reportError } from "./errorReporting";
import {
  FeedbackCategory,
  validateFeedback,
} from "../utils/feedbackInput";

/**
 * Sends a player's feedback.
 *
 * The row is write-only from the client (migration 020): it can be inserted
 * and never read back. Nothing in the app displays feedback, and a submission
 * may quote other people, so there is no reason for the client to hold it.
 *
 * App version and platform ride along because the reports worth acting on are
 * usually the ones you cannot reproduce, and "which build was this" is the
 * first question every time.
 */
export async function submitFeedback(
  category: FeedbackCategory,
  message: string,
): Promise<{ error?: string }> {
  const checked = validateFeedback(category, message);
  if (!checked.ok) return { error: checked.reason };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Should be unreachable: feedback is only reachable from a signed-in
    // screen, and an account is required to play at all.
    return { error: "You need to be signed in to send feedback." };
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    category,
    message: checked.message,
    app_version: Constants.expoConfig?.version ?? null,
    platform: `${Platform.OS} ${Platform.Version}`,
  });

  if (error) {
    console.error("[Feedback] Submission failed:", error.message);
    // Someone took the trouble to write this and it did not arrive. That is
    // worth knowing about, because they are unlikely to type it twice.
    reportError("feedback", error, { category });
    return { error: "Couldn't send that. Please try again." };
  }

  return {};
}

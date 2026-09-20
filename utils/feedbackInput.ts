/**
 * The categories the `feedback` table's CHECK constraint allows. Changing
 * this list means changing that constraint too, or every submission in the
 * new category is rejected by the database.
 */
export const FEEDBACK_CATEGORIES = ["bug", "idea", "puzzle", "other"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** Matches the CHECK constraint on `feedback.message`. */
export const FEEDBACK_MAX_LENGTH = 2000;

export function isFeedbackCategory(value: string): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export type FeedbackValidation =
  | { ok: true; message: string }
  | { ok: false; reason: string };

/**
 * Checks a submission before it is sent.
 *
 * The database enforces the same bounds, so nothing invalid can be stored
 * either way. Doing it here as well means the player is told what is wrong
 * immediately instead of waiting for a round trip to return a constraint
 * violation they cannot read.
 */
export function validateFeedback(
  category: FeedbackCategory,
  message: string,
): FeedbackValidation {
  if (!isFeedbackCategory(category)) {
    return { ok: false, reason: "Pick what your feedback is about." };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "Write a few words before sending." };
  }
  if (trimmed.length > FEEDBACK_MAX_LENGTH) {
    return {
      ok: false,
      reason: `That is longer than ${FEEDBACK_MAX_LENGTH} characters.`,
    };
  }

  return { ok: true, message: trimmed };
}

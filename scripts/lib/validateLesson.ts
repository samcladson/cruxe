/** The teaching content attached to a generated puzzle. */
export interface Lesson {
  /** One short paragraph tying the words together. Absent if unusable. */
  takeaway?: string;
  /** Answer word (uppercase) to its one-sentence fact. */
  facts: Record<string, string>;
}

/** Long enough for a paragraph, short enough that a screen can show it. */
const MAX_TAKEAWAY = 600;
/** One sentence. Anything longer is the model ignoring the brief. */
const MAX_FACT = 240;

function usableText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}

/**
 * Extracts the teaching content from a model response, keeping only what is
 * safe to show.
 *
 * Never throws and never rejects a puzzle. This is the optional half of the
 * response — a malformed lesson costs the player some facts, while a thrown
 * error would cost them the puzzle, and the app's supply of puzzles matters
 * more than any one puzzle's extras.
 *
 * @param raw          Whatever the model returned, entirely untrusted.
 * @param placedWords  The words actually in the finished grid. A fact for a
 *                     word the builder could not place would be shown against
 *                     nothing, so those are dropped.
 */
export function validateLesson(raw: unknown, placedWords: string[]): Lesson {
  const lesson: Lesson = { facts: {} };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return lesson;

  const source = raw as { takeaway?: unknown; words?: unknown };

  lesson.takeaway = usableText(source.takeaway, MAX_TAKEAWAY);

  if (!Array.isArray(source.words)) return lesson;

  const placed = new Set(placedWords.map((w) => w.toUpperCase()));

  for (const entry of source.words) {
    if (!entry || typeof entry !== "object") continue;

    const { word, fact } = entry as { word?: unknown; fact?: unknown };
    if (typeof word !== "string") continue;

    const key = word.trim().toUpperCase();
    if (!placed.has(key)) continue;

    const text = usableText(fact, MAX_FACT);
    if (text) lesson.facts[key] = text;
  }

  return lesson;
}

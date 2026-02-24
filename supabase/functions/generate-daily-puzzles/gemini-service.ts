/**
 * gemini-service.ts — Server-side Gemini API wrapper for puzzle word generation.
 *
 * Uses the Gemini REST API directly (no npm packages) so it runs natively
 * in Deno / Supabase Edge Functions. The API key is stored as a Supabase
 * secret, never exposed to the client.
 */

import {
  type Difficulty,
  type GeneratedClue,
  type GridSize,
  GRID_SIZES,
} from "./crossword-engine.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Generates crossword words + clues for a given category, difficulty, and grid size.
 * Calls the Gemini REST API with structured JSON output.
 *
 * @param category - Puzzle category (or descriptive string for Daily Challenge)
 * @param difficulty - Difficulty level (easy/medium/hard/expert)
 * @param gridSize - Grid dimensions (6/8/10/12)
 * @returns Array of generated words with clues
 */
export async function generatePuzzleWords(
  category: string,
  difficulty: Difficulty,
  gridSize: GridSize,
): Promise<GeneratedClue[]> {
  const settings = GRID_SIZES[gridSize];
  const wordCount = settings.maxWords;
  const maxLength = settings.maxWordLength;

  const prompt = `Generate exactly ${wordCount} unique words appropriate for a ${gridSize}x${gridSize} crossword puzzle grid.
Rules:
1. Category: ${category}
2. Difficulty: ${difficulty}.
   Easy: common, everyday vocabulary.
   Medium: moderate vocabulary, some wordplay.
   Hard: advanced vocabulary, cryptic clue-style hints.
   Expert: obscure vocabulary, very tricky clues.
3. Maximum word length: ${maxLength} letters. Minimum word length: 3 letters.
4. Words MUST vary in length — include short (3-4), medium (4-6), and long words.
5. Choose words with COMMON LETTERS (E, A, R, S, T, N, O, I) to maximise crossword interlocking.
6. Each word needs exactly one concise, clever crossword-style clue (max 60 characters).
7. Exactly 2-3 words must be marked "isHint": true (these become pre-revealed helper letters).
8. ALL WORDS MUST BE UPPERCASE with only A-Z characters.
Return a JSON array of objects with fields: word (string), clue (string), isHint (boolean).
Return ONLY the JSON array, nothing else.`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Extract the text content from the Gemini response
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error("Gemini returned empty response");
  }

  // Parse the JSON array from the response
  const rawData = JSON.parse(responseText);

  // Sanitize and validate the generated words
  return rawData
    .filter(
      (item: Record<string, unknown>) =>
        item.word && item.clue && typeof item.word === "string",
    )
    .map((item: Record<string, unknown>) => ({
      word: (item.word as string).toUpperCase().replace(/[^A-Z]/g, ""),
      clue: item.clue as string,
      isHint: Boolean(item.isHint),
    }))
    .filter(
      (item: GeneratedClue) =>
        item.word.length >= 3 && item.word.length <= maxLength,
    )
    .slice(0, wordCount);
}

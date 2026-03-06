import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GRID_SIZES } from "../constants/levels";
import { Category, Difficulty, GridSize } from "../types/puzzle.types";

// Keep the API key securely managed in a real scenario
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface GeneratedClue {
  word: string;
  clue: string;
  isHint: boolean;
}

/**
 * Generates a list of crossword words and clues for a given category, difficulty,
 * and grid size using Gemini 2.5 Flash.
 *
 * The prompt is date-aware: today's date is injected so Gemini draws on its
 * knowledge of what is currently trending and culturally relevant in the given
 * category. No live search or grounding is used — this is fully free-tier safe.
 *
 * @param category  - Puzzle category (e.g. "technology", "sports")
 * @param difficulty - Puzzle difficulty level
 * @param gridSize  - Size of the crossword grid (6, 8, 10, or 12)
 * @returns Array of GeneratedClue objects ready for grid placement
 */
export const generatePuzzleWords = async (
  category: Category,
  difficulty: Difficulty,
  gridSize: GridSize,
): Promise<GeneratedClue[]> => {
  const settings = GRID_SIZES[gridSize];
  const wordCount = settings.maxWords;
  const maxLength = settings.maxWordLength;

  // Inject today's date so Gemini can reason about current events and trends
  const today = new Date().toISOString().split("T")[0];

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.95,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            word: {
              type: SchemaType.STRING,
              description:
                "The crossword answer word. UPPERCASE, A-Z only, no spaces or hyphens.",
            },
            clue: {
              type: SchemaType.STRING,
              description:
                "A clever, concise crossword clue. Max 65 characters. Never states the answer or a direct synonym.",
            },
            isHint: {
              type: SchemaType.BOOLEAN,
              description:
                "True for exactly 2-3 short, common-letter words chosen to help players get a grid foothold. Never mark thematic highlight words as hints.",
            },
          },
          required: ["word", "clue", "isHint"],
        },
      },
    },
  });

  const prompt = `You are the puzzle editor of an award-winning crossword publication renowned for \
puzzles that feel sharp, current, and culturally alive — the kind solvers share because a clue \
made them groan and grin at the same time.

Today's date: ${today}
Category: ${category}
Grid: ${gridSize}×${gridSize} | Words needed: ${wordCount} | Max word length: ${maxLength} letters

━━━ FRESHNESS & RELEVANCE ━━━
Draw on your knowledge of what is currently trending, talked-about, and culturally significant \
in the "${category}" space as of ${today}.
Think: recent events, people in the news, viral moments, award winners, record-breakers, product \
launches, chart-toppers, ongoing storylines, notable headlines, breakthrough moments.
At least 40% of words should connect to something that feels zeitgeist-relevant right now.

━━━ WORD QUALITY — ZERO TOLERANCE POLICY ━━━
PERMANENTLY BANNED crossword filler (never use these or anything of this character):
ERA, ORE, OLE, ALE, SEA, ARIA, ETNA, ABET, ALOE, OLEO, EROS, ESNE, ANEW, ONES,
INANE, ATONE, EIRE, ERNE, ALEE, NENE, ELSE, ALEC, YORE, IAMB, NARC, TSAR, OTIC.
If a word feels stale, dusty, or "crossword-y" without real-world weight — replace it.

Every word must be vivid, specific, and carry cultural or contextual weight.
Prefer: proper nouns, sharp verbs, evocative concrete nouns, acronyms with currency.
Avoid: vague abstractions, generic adjectives, purely archaic or obscure Latin.

━━━ DIFFICULTY: ${difficulty} ━━━
  Easy   → Widely known vocabulary. Direct definitions. The solver should feel smart
            and rewarded — never stumped by the word itself, only delighted by the clue.
  Medium → Mix of familiar and slightly niche terms. Clues use gentle misdirection,
            double meanings, or light wordplay. One small "aha" moment per clue.
  Hard   → Niche vocabulary requiring specific knowledge. Cryptic-adjacent clues that
            mislead on first reading and reward on reflection. Surface and solution differ.
  Expert → Deep cultural cuts and cross-domain wordplay that separates casual solvers
            from enthusiasts. Clues are elegant traps — precise, layered, fair but fiendish.

━━━ GRID CONSTRAINTS ━━━
- Word lengths: 3 to ${maxLength} letters. Actively MIX lengths: short (3-4), medium (5-6), long (7+).
- Maximise grid interlocking by favouring letters: E, A, R, S, T, N, O, I.
- ALL WORDS: UPPERCASE, A-Z only, absolutely no spaces, hyphens, or punctuation.

━━━ CLUE RULES ━━━
- Maximum 65 characters per clue.
- Never use the answer word or a direct synonym anywhere in the clue.
- Exactly one unambiguous correct answer — no clue should allow two valid solutions.
- Hard and Expert clues must have a surface reading that misleads before the aha lands.
- Easy and Medium clues should feel satisfying, not frustrating.

━━━ HINTS (isHint: true) ━━━
Mark exactly 2-3 words as isHint true. These become pre-revealed letters to help players
get a foothold in the grid. Choose short (3-5 letter), common-letter words strategically —
never your most interesting or thematic words.

Return a JSON array of exactly ${wordCount} objects. No markdown, no extra text.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const rawData = JSON.parse(responseText);

    // Sanity-check filter: ensure all required fields are present and valid
    return rawData
      .filter(
        (item: any) =>
          item.word &&
          item.clue &&
          typeof item.word === "string" &&
          typeof item.clue === "string" &&
          /^[A-Z]+$/.test(item.word.toUpperCase().replace(/[^A-Z]/g, "")),
      )
      .map((item: any) => ({
        word: item.word.toUpperCase().replace(/[^A-Z]/g, ""),
        clue: item.clue,
        isHint: Boolean(item.isHint),
      }))
      .filter(
        (item: GeneratedClue) =>
          item.word.length >= 3 && item.word.length <= maxLength,
      )
      .slice(0, wordCount);
  } catch (error) {
    console.error("Gemini generation failed:", error);
    throw new Error("Failed to generate puzzle configuration");
  }
};

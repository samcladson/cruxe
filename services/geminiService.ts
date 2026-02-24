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

export const generatePuzzleWords = async (
  category: Category,
  difficulty: Difficulty,
  gridSize: GridSize,
): Promise<GeneratedClue[]> => {
  const settings = GRID_SIZES[gridSize];
  const wordCount = settings.maxWords;
  const maxLength = settings.maxWordLength;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.9,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            word: {
              type: SchemaType.STRING,
              description:
                "The uppercase answer word containing only A-Z without spaces.",
            },
            clue: {
              type: SchemaType.STRING,
              description:
                "A clever, concise crossword clue, max 60 characters.",
            },
            isHint: {
              type: SchemaType.BOOLEAN,
              description:
                "True if this is an easier word meant to be a subtle in-puzzle hint. Exactly 2-3 words should have this set to true.",
            },
          },
          required: ["word", "clue", "isHint"],
        },
      },
    },
  });

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
Return JSON ONLY.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const rawData = JSON.parse(responseText);

    // Fallback sanity check filter
    return rawData
      .filter(
        (item: any) => item.word && item.clue && typeof item.word === "string",
      )
      .map((item: any) => ({
        word: item.word.toUpperCase().replace(/[^A-Z]/g, ""),
        clue: item.clue,
        isHint: Boolean(item.isHint),
      }))
      .slice(0, wordCount);
  } catch (error) {
    console.error("Gemini generation failed:", error);
    throw new Error("Failed to generate puzzle configuration");
  }
};

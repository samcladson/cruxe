export type Category =
  | "general"
  | "history"
  | "technology"
  | "entertainment"
  | "sports";
export type Difficulty = "easy" | "medium" | "hard" | "expert";
export type GridSize = 6 | 8 | 10 | 12;
export type Direction = "across" | "down" | "reverse_across" | "reverse_down";

export interface CrosswordClue {
  id: string; // e.g. "1-across", "3-down"
  number: number;
  direction: Direction;
  clue: string;
  answer: string; // uppercase
  startRow: number;
  startCol: number;
  length: number;
  isPreFilled: boolean; // true for subtle hint words
  preFilledIndices: number[]; // which letter indices are pre-revealed
}

export interface GridCell {
  row: number;
  col: number;
  letter: string | null; // null = black/blocked cell
  isBlocked: boolean;
  isPreFilled: boolean;
  userInput: string;
  clueNumbers: number[]; // cells can belong to multiple clues
  clueIds: string[];
  state: "empty" | "filled" | "correct" | "incorrect" | "prefilled";
}

export interface Puzzle {
  id: string;
  category: Category;
  difficulty: Difficulty;
  gridSize: GridSize;
  grid: GridCell[][];
  clues: CrosswordClue[];
  acrossClues: CrosswordClue[];
  downClues: CrosswordClue[];
  reverseAcrossClues: CrosswordClue[];
  reverseDownClues: CrosswordClue[];
  date: string; // ISO date string — daily puzzle key
  estimatedTime: number; // seconds
  totalWords: number;
  solvedWords: number;
  isComplete: boolean;
  startedAt: number | null;
  completedAt: number | null;
  score: number;
  hintsUsed: number;
}

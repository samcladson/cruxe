import { Difficulty, GridSize } from "../types/puzzle.types";

export const LEVELS: Record<
  Difficulty,
  { label: string; color: string; icon: string }
> = {
  easy: {
    label: "Easy",
    color: "#2ECC71",
    icon: "leaf-outline",
  },
  medium: {
    label: "Medium",
    color: "#C9A84C",
    icon: "flame-outline",
  },
  hard: {
    label: "Hard",
    color: "#E74C3C",
    icon: "skull-outline",
  },
  expert: {
    label: "Expert",
    color: "#9333ea",
    icon: "diamond-outline",
  },
};

export const GRID_SIZES: Record<
  GridSize,
  { label: string; maxWords: number; maxWordLength: number }
> = {
  6: { label: "6x6", maxWords: 14, maxWordLength: 6 },
  8: { label: "8x8", maxWords: 22, maxWordLength: 8 },
  10: { label: "10x10", maxWords: 32, maxWordLength: 10 },
  12: { label: "12x12", maxWords: 44, maxWordLength: 12 },
};

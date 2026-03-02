import { Category } from "./puzzle.types";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: string | null;
}

export interface CategoryStat {
  solved: number;
  averageTime: number;
  bestTime: number;
  accuracy: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string;
  coins: number;
  totalScore: number;
  totalPuzzlesSolved: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string;
  categoryStats: Record<Category, CategoryStat>;
  achievements: Achievement[];
  rank: number;
}

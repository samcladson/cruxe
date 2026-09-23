import { CATEGORIES } from "../constants/categories";
import { Category } from "../types/puzzle.types";

/**
 * How a completed puzzle is named in Recent Activity and its history.
 *
 * The subject is the name — "The Apollo Programme", not "History • Medium",
 * which every other history puzzle at that level would share. Category and
 * level still matter, so they sit beneath it as `detail`. Puzzles generated
 * before titles existed (migration 016) have nothing better, so they keep
 * category and level as the heading and carry no detail to repeat it.
 */
export function activityLabel(item: {
  title: string | null;
  category: Category;
  difficulty: string;
}): { heading: string; detail: string | null } {
  const categoryTitle = CATEGORIES[item.category]?.title || "General";
  const difficultyTitle =
    item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1);
  const categoryAndLevel = `${categoryTitle} • ${difficultyTitle}`;

  const title = item.title?.trim();
  if (!title) return { heading: categoryAndLevel, detail: null };
  return { heading: title, detail: categoryAndLevel };
}

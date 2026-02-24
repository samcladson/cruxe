import { Category } from "../types/puzzle.types";

export const CATEGORIES: Record<
  Category,
  { title: string; icon: string; color: string; description: string }
> = {
  general: {
    title: "General",
    icon: "public",
    color: "#3b82f6", // Blue
    description: "Wordplay & Trivia",
  },
  history: {
    title: "History",
    icon: "history-edu",
    color: "#a855f7", // Purple
    description: "Past & Present",
  },
  technology: {
    title: "Tech",
    icon: "memory",
    color: "#10b981", // Green
    description: "Modern Era",
  },
  entertainment: {
    title: "Entertainment",
    icon: "theaters",
    color: "#ef4444", // Red
    description: "Pop Culture",
  },
  sports: {
    title: "Sports",
    icon: "sports-tennis",
    color: "#F0EDE8", // Light
    description: "Athletes & events",
  },
};

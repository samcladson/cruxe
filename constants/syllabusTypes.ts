import { Category } from "../types/puzzle.types";

/** The most characters a title may use. See below for why. */
export const MAX_TITLE_LENGTH = 30;

/** The most characters a standfirst may use — roughly two lines on a phone. */
export const MAX_STANDFIRST_LENGTH = 120;

export interface SyllabusTopic {
  /**
   * Stable identifier. It keys `topic_usage`, so renaming one resets that
   * subject's rotation and reusing one for a different subject corrupts it.
   */
  id: string;
  category: Category;
  /**
   * The puzzle's title, shown on cards and in-game.
   *
   * At most MAX_TITLE_LENGTH characters, and it names the subject rather than
   * describing it. This is read at a glance while scrolling, on a phone, at a
   * card width of roughly 300px — a title that wraps to three lines is not
   * read at all. "The Silk Road", not "A Journey Along the Ancient Silk Road
   * Trade Routes".
   */
  title: string;
  /** One or two lines under the title, framing why the subject is worth knowing. */
  standfirst: string;
  /**
   * Distinct briefs within the subject, each producing a different puzzle.
   * Angles are what make a 200-entry syllabus cover 600 puzzles.
   */
  angles: string[];
}

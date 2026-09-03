import { SYLLABUS } from "../constants/syllabus";
import {
  MAX_STANDFIRST_LENGTH,
  MAX_TITLE_LENGTH,
} from "../constants/syllabusTypes";
import { CATEGORIES } from "../constants/categories";

/**
 * The syllabus is long, hand-edited, and written over months. Every rule here
 * is one that discipline alone would eventually fail to hold.
 */
describe("syllabus integrity", () => {
  it("has entries for every category the app offers", () => {
    for (const category of Object.keys(CATEGORIES)) {
      const count = SYLLABUS.filter((t) => t.category === category).length;
      expect({ category, hasTopics: count > 0 }).toEqual({
        category,
        hasTopics: true,
      });
    }
  });

  it("uses each id exactly once", () => {
    // A duplicate id silently collapses two subjects into one rotation slot.
    const seen = new Map<string, number>();
    for (const topic of SYLLABUS) {
      seen.set(topic.id, (seen.get(topic.id) ?? 0) + 1);
    }
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1);
    expect(duplicates).toEqual([]);
  });

  it("uses ids that are stable, url-safe slugs", () => {
    const bad = SYLLABUS.filter((t) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id));
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  it("keeps every title within the readable limit", () => {
    // The rule that is easiest to break and most visible when broken.
    const tooLong = SYLLABUS.filter((t) => t.title.length > MAX_TITLE_LENGTH);
    expect(
      tooLong.map((t) => `${t.id}: ${t.title.length} chars — "${t.title}"`),
    ).toEqual([]);
  });

  it("keeps every standfirst within two lines", () => {
    const tooLong = SYLLABUS.filter(
      (t) => t.standfirst.length > MAX_STANDFIRST_LENGTH,
    );
    expect(tooLong.map((t) => `${t.id}: ${t.standfirst.length} chars`)).toEqual(
      [],
    );
  });

  it("has no empty or untrimmed text", () => {
    const bad = SYLLABUS.filter(
      (t) =>
        t.title.trim() !== t.title ||
        t.standfirst.trim() !== t.standfirst ||
        t.title.length === 0 ||
        t.standfirst.length === 0,
    );
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  it("gives every topic at least one angle, all distinct", () => {
    const bad = SYLLABUS.filter(
      (t) =>
        t.angles.length === 0 ||
        new Set(t.angles).size !== t.angles.length ||
        t.angles.some((a) => a.trim().length === 0),
    );
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  it("names each subject only once", () => {
    // Two ids with the same title would read to a player as a repeat.
    const seen = new Map<string, string[]>();
    for (const topic of SYLLABUS) {
      const key = topic.title.toLowerCase();
      seen.set(key, [...(seen.get(key) ?? []), topic.id]);
    }
    const clashes = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    expect(clashes).toEqual([]);
  });

  it("carries enough topics to keep the rotation from feeling repetitive", () => {
    // 19 puzzles a day. Below this the same brief returns within a fortnight.
    const briefs = SYLLABUS.reduce((sum, t) => sum + t.angles.length, 0);
    expect(briefs).toBeGreaterThanOrEqual(400);
  });
});

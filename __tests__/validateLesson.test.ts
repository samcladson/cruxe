import { validateLesson } from "../scripts/lib/validateLesson";

const words = ["SATURNV", "EAGLE", "LUNAR"];

/**
 * The lesson block is the optional half of the model's response. Nothing here
 * may throw or reject a puzzle: losing the extras is acceptable, losing the
 * puzzle is not.
 */
describe("validateLesson", () => {
  it("keeps a well-formed lesson", () => {
    const out = validateLesson(
      {
        takeaway: "Apollo needed a rocket, a lander and a plan.",
        words: [
          { word: "SATURNV", fact: "363 feet tall." },
          { word: "EAGLE", fact: "The lunar module." },
        ],
      },
      words,
    );
    expect(out.takeaway).toBe("Apollo needed a rocket, a lander and a plan.");
    expect(out.facts).toEqual({
      SATURNV: "363 feet tall.",
      EAGLE: "The lunar module.",
    });
  });

  it("drops facts for words that are not in the puzzle", () => {
    // The model sometimes returns a word the grid builder could not place.
    // A fact for a word the player never saw would be baffling.
    const out = validateLesson(
      { words: [{ word: "APOLLO", fact: "Not placed in this grid." }] },
      words,
    );
    expect(out.facts).toEqual({});
  });

  it("matches words case-insensitively", () => {
    const out = validateLesson(
      { words: [{ word: "eagle", fact: "The lunar module." }] },
      words,
    );
    expect(out.facts).toEqual({ EAGLE: "The lunar module." });
  });

  it("tolerates a missing takeaway", () => {
    const out = validateLesson({ words: [{ word: "LUNAR", fact: "Of the Moon." }] }, words);
    expect(out.takeaway).toBeUndefined();
    expect(out.facts).toEqual({ LUNAR: "Of the Moon." });
  });

  it("returns an empty lesson rather than throwing on rubbish", () => {
    for (const input of [null, undefined, "text", 42, [], {}, { words: "no" }]) {
      const out = validateLesson(input, words);
      expect(out.facts).toEqual({});
      expect(out.takeaway).toBeUndefined();
    }
  });

  it("ignores blank and non-string facts", () => {
    const out = validateLesson(
      {
        words: [
          { word: "EAGLE", fact: "   " },
          { word: "LUNAR", fact: 42 },
          { word: "SATURNV", fact: "Kept." },
        ],
      },
      words,
    );
    expect(out.facts).toEqual({ SATURNV: "Kept." });
  });

  it("trims whitespace and caps runaway length", () => {
    const out = validateLesson(
      {
        takeaway: `  ${"t".repeat(2000)}  `,
        words: [{ word: "EAGLE", fact: `  ${"f".repeat(2000)}  ` }],
      },
      words,
    );
    expect(out.takeaway!.length).toBeLessThanOrEqual(600);
    expect(out.facts.EAGLE.length).toBeLessThanOrEqual(240);
  });

  it("reports empty when the puzzle has no words", () => {
    const out = validateLesson({ words: [{ word: "EAGLE", fact: "x" }] }, []);
    expect(out.facts).toEqual({});
  });
});

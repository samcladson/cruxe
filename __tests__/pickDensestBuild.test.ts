import {
  pickDensestBuild,
  GRID_BUILD_ATTEMPTS,
} from "../scripts/lib/pickDensestBuild";
import { buildPuzzle } from "../services/crosswordEngine";

/** A stand-in build result carrying only the compared field. */
const result = (clueCount: number) => ({
  clues: Array.from({ length: clueCount }, (_, i) => i),
  tag: clueCount,
});

describe("pickDensestBuild", () => {
  it("returns null when every attempt fails", () => {
    // Grid construction genuinely can fail, and the caller treats null as
    // "this puzzle could not be built" rather than as an empty puzzle.
    const build = jest.fn(() => null);
    expect(pickDensestBuild(build, 5)).toBeNull();
    expect(build).toHaveBeenCalledTimes(5);
  });

  it("returns the one success among failures", () => {
    const outcomes = [null, null, result(7), null];
    let i = 0;
    const picked = pickDensestBuild(() => outcomes[i++], 4);
    expect(picked!.clues).toHaveLength(7);
  });

  it("keeps the fullest grid", () => {
    const outcomes = [result(9), result(14), result(11)];
    let i = 0;
    const picked = pickDensestBuild(() => outcomes[i++], 3);
    expect((picked as any).tag).toBe(14);
  });

  it("keeps the earlier result on a tie", () => {
    // A stable choice means an unchanged word list does not yield a
    // gratuitously different grid on every run.
    const first = result(10);
    const second = result(10);
    const outcomes = [first, second];
    let i = 0;
    expect(pickDensestBuild(() => outcomes[i++], 2)).toBe(first);
  });

  it("samples exactly the requested number of times", () => {
    const build = jest.fn(() => result(5));
    pickDensestBuild(build, 10);
    expect(build).toHaveBeenCalledTimes(10);
  });

  it("treats a non-positive attempt count as a single build", () => {
    const build = jest.fn(() => result(5));
    pickDensestBuild(build, 0);
    pickDensestBuild(build, -3);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("defaults to the configured attempt count", () => {
    const build = jest.fn(() => result(5));
    pickDensestBuild(build);
    expect(build).toHaveBeenCalledTimes(GRID_BUILD_ATTEMPTS);
  });
});

describe("pickDensestBuild against the real engine", () => {
  const words = [
    "SILK","SPICE","CAMEL","JADE","ROME","HAN","POLO","XIAN","GOLD","TAX",
    "PLAGUE","NOMAD","COIN","OASIS","CARAVAN","PAPER","MERCHANT","BUDDHISM",
    "IVORY","SALT","ROUTE","DESERT","TRADER","SADDLE","AMBER","LOOM",
    "INCENSE","PORCELAIN","MONGOL","BAZAAR","RELIC","STEPPE",
  ].map((w) => ({ word: w, clue: `clue for ${w}`, isHint: false }));

  const build = () =>
    buildPuzzle(words, "history" as any, "medium" as any, 10 as any, undefined);

  it("never places fewer words than a single build's floor", () => {
    // The point of sampling is raising the worst case. A single 10x10 build
    // of this list bottoms out around 11 words; sampling ten must clear that
    // every time, or the change is not buying the consistency it claims.
    for (let trial = 0; trial < 5; trial++) {
      const picked = pickDensestBuild(build, GRID_BUILD_ATTEMPTS);
      expect(picked).not.toBeNull();
      expect(picked!.clues.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("produces a grid whose every clue answer is a requested word", () => {
    const picked = pickDensestBuild(build, 3);
    const asked = new Set(words.map((w) => w.word));
    for (const clue of picked!.clues as { answer: string }[]) {
      expect(asked.has(clue.answer)).toBe(true);
    }
  });
});

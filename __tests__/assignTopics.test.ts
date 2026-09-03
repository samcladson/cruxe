import { assignTopics, TopicUsage } from "../scripts/lib/assignTopics";
import { SyllabusTopic } from "../constants/syllabusTypes";

const topics: SyllabusTopic[] = [
  { id: "t-a", category: "technology", title: "A", standfirst: "a", angles: ["x", "y"] },
  { id: "t-b", category: "technology", title: "B", standfirst: "b", angles: ["x"] },
  { id: "t-c", category: "technology", title: "C", standfirst: "c", angles: ["x"] },
  { id: "h-a", category: "history", title: "HA", standfirst: "ha", angles: ["x"] },
  { id: "h-b", category: "history", title: "HB", standfirst: "hb", angles: ["x"] },
];

const spec = (category: string) => ({ category }) as any;

describe("assignTopics", () => {
  it("gives each puzzle a topic from its own category", () => {
    const out = assignTopics(
      [spec("technology"), spec("history")],
      topics,
      [],
      "2026-09-03",
    );
    expect(out[0].topic!.category).toBe("technology");
    expect(out[1].topic!.category).toBe("history");
  });

  it("never uses the same topic twice in one day", () => {
    // Three technology puzzles, three technology topics: all must differ, or
    // a player sees the same subject twice in one day's collection.
    const out = assignTopics(
      [spec("technology"), spec("technology"), spec("technology")],
      topics,
      [],
      "2026-09-03",
    );
    const ids = out.map((a) => a.topic!.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("prefers the topic used longest ago", () => {
    const usage: TopicUsage[] = [
      { topicId: "t-a", lastUsedOn: "2026-09-01" },
      { topicId: "t-b", lastUsedOn: "2026-08-01" },
      { topicId: "t-c", lastUsedOn: "2026-09-02" },
    ];
    const out = assignTopics([spec("technology")], topics, usage, "2026-09-03");
    expect(out[0].topic!.id).toBe("t-b");
  });

  it("uses a never-used topic before any that has been used", () => {
    const usage: TopicUsage[] = [
      { topicId: "t-a", lastUsedOn: "2020-01-01" },
      { topicId: "t-b", lastUsedOn: "2020-01-01" },
    ];
    const out = assignTopics([spec("technology")], topics, usage, "2026-09-03");
    expect(out[0].topic!.id).toBe("t-c");
  });

  it("reuses the least recent topic rather than failing when a category runs out", () => {
    // Four puzzles, three topics. A puzzle without a topic would be a puzzle
    // that cannot be generated, which is a worse outcome than a repeat.
    const out = assignTopics(
      [spec("technology"), spec("technology"), spec("technology"), spec("technology")],
      topics,
      [],
      "2026-09-03",
    );
    expect(out).toHaveLength(4);
    expect(out.every((a) => a.topic!.category === "technology")).toBe(true);
  });

  it("varies the angle so a repeated topic is not a repeated puzzle", () => {
    const usage: TopicUsage[] = [];
    const day1 = assignTopics([spec("technology")], topics, usage, "2026-09-03");
    const day2 = assignTopics(
      [spec("technology")],
      topics,
      [{ topicId: day1[0].topic!.id, lastUsedOn: "2026-09-03" }],
      "2026-09-04",
    );
    // Different topics here, but the angle must be drawn from the topic's own
    // list in both cases.
    expect(day1[0].topic!.angles).toContain(day1[0].angle);
    expect(day2[0].topic!.angles).toContain(day2[0].angle);
  });

  it("is deterministic for the same inputs", () => {
    const a = assignTopics([spec("technology"), spec("history")], topics, [], "2026-09-03");
    const b = assignTopics([spec("technology"), spec("history")], topics, [], "2026-09-03");
    expect(a.map((x) => `${x.topic!.id}:${x.angle}`)).toEqual(
      b.map((x) => `${x.topic!.id}:${x.angle}`),
    );
  });

  it("leaves a spec without a topic when its category has none at all", () => {
    // Better to generate the puzzle untitled than not at all.
    const out = assignTopics([spec("sports")], topics, [], "2026-09-03");
    expect(out[0].topic).toBeNull();
  });
});

import { SYLLABUS } from "../../constants/syllabus";
import { SyllabusTopic } from "../../constants/syllabusTypes";

/** One row of the `topic_usage` table. */
export interface TopicUsage {
  topicId: string;
  /** ISO date (YYYY-MM-DD) the topic was last built into a puzzle. */
  lastUsedOn: string;
}

/** Only the field of a puzzle spec that topic assignment cares about. */
interface CategorySpec {
  category: string;
}

export interface TopicAssignment<S extends CategorySpec = CategorySpec> {
  spec: S;
  /** Null only when the syllabus has no entry for the spec's category. */
  topic: SyllabusTopic | null;
  /** The brief within the topic. Empty when there is no topic. */
  angle: string;
}

/**
 * Chooses a subject for each puzzle of the day.
 *
 * Two rules, in order of importance:
 *
 *  1. No topic is used twice on the same day. A player opening the day's
 *     collection and seeing the same subject twice would read the whole thing
 *     as padding.
 *  2. Otherwise, least recently used wins — a topic never touched beats one
 *     used last year, which beats one used yesterday. This is what turns 603
 *     briefs into a rotation rather than a random draw that clusters.
 *
 * Running out is not an error. A category with fewer topics than puzzles
 * reuses its least recent, because a puzzle without a topic is a puzzle that
 * still has to be generated, and a repeat is a far better outcome than a gap
 * in the day's supply.
 *
 * Pure: no network, no database, no clock. `date` is passed in so a run can
 * be reproduced exactly.
 */
export function assignTopics<S extends CategorySpec>(
  specs: S[],
  syllabus: SyllabusTopic[] = SYLLABUS,
  usage: TopicUsage[] = [],
  date: string = new Date().toISOString().slice(0, 10),
): TopicAssignment<S>[] {
  const lastUsed = new Map(usage.map((u) => [u.topicId, u.lastUsedOn]));

  // "" sorts before any ISO date, so a topic never used comes first.
  const staleness = (topic: SyllabusTopic) => lastUsed.get(topic.id) ?? "";

  const byCategory = new Map<string, SyllabusTopic[]>();
  for (const topic of syllabus) {
    const list = byCategory.get(topic.category) ?? [];
    list.push(topic);
    byCategory.set(topic.category, list);
  }
  // Sorted once per category; ties broken by id so the result is stable.
  for (const list of byCategory.values()) {
    list.sort((a, b) => {
      const diff = staleness(a).localeCompare(staleness(b));
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
  }

  const usedToday = new Set<string>();
  const assignments: TopicAssignment<S>[] = [];

  for (const spec of specs) {
    const candidates = byCategory.get(spec.category) ?? [];

    if (candidates.length === 0) {
      assignments.push({ spec, topic: null, angle: "" });
      continue;
    }

    const topic =
      candidates.find((t) => !usedToday.has(t.id)) ??
      // Category exhausted for today: fall back to the least recent overall.
      candidates[0];

    usedToday.add(topic.id);

    assignments.push({
      spec,
      topic,
      angle: pickAngle(topic, date),
    });
  }

  return assignments;
}

/**
 * Picks which brief of a topic to use.
 *
 * Derived from the topic id and the date rather than chosen at random, so a
 * run is reproducible and so the same topic returning next month is unlikely
 * to arrive on the same angle.
 */
function pickAngle(topic: SyllabusTopic, date: string): string {
  const seed = [...`${topic.id}${date}`].reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) % 100000,
    7,
  );
  return topic.angles[seed % topic.angles.length];
}

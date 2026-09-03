# Topic-Led Puzzles

**Date:** 2026-09-03
**Status:** Approved design, not yet implemented

## Problem

Every puzzle in the app is titled by its difficulty — `EASY`, `MEDIUM`,
`HARD`, `EXPERT`. That is a property of the puzzle, not a description of it,
and a list of four repeating words reads as a placeholder rather than a
catalogue. Nothing tells a player what a puzzle is *about* before they open
it, and nothing remains with them after they close it.

The words within a puzzle are also unrelated to each other. The generator asks
for "sharp, current, culturally alive" vocabulary in a category, so a
technology puzzle may contain a rocket, a programming language and a
streaming service. Each word is fine; together they teach nothing.

## Goal

A puzzle is *about something*. It carries a title naming its subject, every
word belongs to that subject, and finishing it leaves the player with
something they did not know before.

Difficulty does not disappear — scoring, filtering and the free-play economy
all depend on it. It stops being the headline.

## Constraint that shapes the design

The generator makes **19 Gemini requests per day against a free-tier limit of
20 RPD**. One spare request. Any design needing a second call per puzzle would
require 38/day and is impossible.

Therefore: **enrich the response already being paid for.** Asking for a
takeaway and a per-word fact in the same call costs output tokens
(~+300/puzzle, far inside the free tier's token-per-minute allowance) and not
one extra request. The budget is unchanged by this work.

## Non-goals

- Regenerating or backfilling existing puzzles. They keep showing
  `Medium Puzzle` until they age out. A backfill is one request per puzzle,
  which the budget cannot absorb.
- Facts shown during play. They appear only after solving, so a puzzle stays
  a puzzle and the learning is the reward for finishing.
- Replacing the difficulty system.

## Repetition: the arithmetic

19 puzzles a day, each on a distinct subject, is roughly **7,000 subjects a
year**. That cannot be curated, so "a topic never repeats" is not achievable
and this design does not claim it.

What is achievable: each syllabus entry carries several **angles**.

```
The Apollo Programme → "the hardware" | "the people" | "the mission profile"
```

250 topics × 3 angles = 750 distinct briefs, roughly a **40-day cycle** before
any brief recurs — and a recurrence is a different puzzle, since the words and
clues are generated fresh. Authoring effort stays at 250 entries.

**Delivered in this work:** 40 topics per category across the five categories
— 200 entries, each with 3 angles, giving 600 briefs and a ~31-day cycle.
Weighted towards evergreen subjects that reward being taught (how something
works, why something mattered) over trivia that merely tests recall, since
teaching is the point. Current-affairs freshness is already handled by the
existing date-aware prompt and does not belong in a checked-in file that would
go stale.

## Architecture

### The syllabus

A checked-in, typed file — `constants/syllabus.ts` — is the source of truth
for what the app teaches.

```ts
export interface SyllabusTopic {
  /** Stable id. Never reused for a different subject; it keys topic_usage. */
  id: string;
  category: Category;
  /** Shown as the puzzle's title. Human-written, never model-generated. */
  title: string;
  /** One line under the title, framing why the subject is interesting. */
  standfirst: string;
  /** Distinct briefs within the subject. At least one. */
  angles: string[];
}
```

Title and standfirst are authored, not generated. This is the design's main
safety property: a malformed model response costs the facts, never the title.
The failure mode is "a good puzzle without its extras", never a regression to
`Medium Puzzle`.

### Data model

Three nullable columns on `daily_puzzles`:

| Column | Type | Why |
|---|---|---|
| `topic_id` | `TEXT` | Which syllabus entry produced it; drives rotation. |
| `title` | `TEXT` | Shown on cards and in-game. |
| `standfirst` | `TEXT` | The line under the title. |

Nullable is what makes forward-only safe: existing rows keep `NULL` and the UI
falls back.

The post-solve content lives in `puzzle_data.lesson`, not in new columns:

```jsonc
{ "lesson": { "takeaway": "…", "facts": { "SATURNV": "…", "EAGLE": "…" } } }
```

This honours the reason the lightweight columns exist in the first place —
*"avoids loading the full puzzle_data JSONB just to show cards"* (migration
001). Listing screens need the title; they never need the facts.

One new table so rotation survives the retention cleanup that deletes old
`daily_puzzles` rows:

```sql
CREATE TABLE topic_usage (
  topic_id     TEXT PRIMARY KEY,
  category     TEXT NOT NULL,
  last_used_on DATE NOT NULL
);
```

### Generation flow

```
buildRotatingManifest(date)      19 specs: category, difficulty, gridSize
        │
        ▼
assignTopics(specs, usage)       least-recently-used topic per category,
        │                        never one already used today
        ▼
one Gemini call per spec         prompt gains topic + angle
        │                        responseSchema returns an object
        ▼
validateWords + validateLesson   words as today; lesson optional
        │
        ▼
upsert daily_puzzles             title/standfirst always from the syllabus
record topic_usage
```

`assignTopics` is pure — specs and usage rows in, assignments out — so it is
testable without a network or a database.

The response schema changes from an array to an object:

```jsonc
{
  "takeaway": "One paragraph tying the words into a single idea.",
  "words": [{ "word": "…", "clue": "…", "isHint": true, "fact": "…" }]
}
```

`responseSchema` is already in use by the generator, so this is a change of
shape rather than of technique. The existing regex fallback for malformed JSON
is retained for the words; the lesson block simply drops if it will not parse.

### UI

Cards lead with the title and demote the classification to a kicker:

```
┌──────────────────────────────┐
│ TECHNOLOGY · MEDIUM · 8×8    │
│                              │
│ The Apollo Programme         │
│ Eleven missions, one decade, │
│ and the vocabulary that got  │
│ there.                       │
│                              │
│ 14 words · ~6 min            │
└──────────────────────────────┘
```

Touched: the collection list, the category list, the game screen header, and
the completion screen, which gains a "What you learned" section showing the
takeaway followed by each solved word and its fact.

Every one of these falls back to the current
`difficulty + " Puzzle"` string when `title` is null, which is what makes the
forward-only rollout safe.

## Error handling

| Failure | Behaviour |
|---|---|
| Model returns no `takeaway` | Puzzle ships; completion screen omits the section. |
| A `fact` names a word not in the grid | That fact is dropped in validation. |
| Lesson block unparseable | Words still validate; puzzle ships titled, without extras. |
| Syllabus exhausted for a category | Least-recently-used entry is reused; logged as a signal to add topics. |
| Existing puzzle with `title = NULL` | UI falls back to `Medium Puzzle`. |

No failure in this feature may prevent a puzzle being generated. The app's
supply of puzzles is more important than any one puzzle's extras.

## Testing

The Gemini call cannot be unit-tested in this repo (jest runs in a node
environment with no network fixtures), so the logic is extracted from it and
tested directly:

- **`assignTopics`** — never assigns one topic twice in a day; prefers the
  least-recently-used; falls back sanely when a category is exhausted;
  deterministic for a given date.
- **Syllabus integrity** — ids unique, categories valid, no empty titles or
  standfirsts, every entry has at least one angle. This is a test rather than
  a convention because the syllabus is long and hand-edited.
- **`validateLesson`** — drops facts for words absent from the grid, tolerates
  a missing takeaway, never throws on malformed input.

UI changes have no component-test infrastructure here and will be verified by
`tsc` and on a build.

## Rollout

1. Migration adding the three nullable columns and `topic_usage`. Safe on a
   live database: no rewrite, no lock of consequence, no existing row changed.
2. Syllabus committed.
3. Generator updated. The next scheduled run produces titled puzzles.
4. UI updated with fallbacks, so it can ship before or after step 3.

Steps 3 and 4 are independent. Neither breaks the other if only one lands.

## Open question deferred

Whether angles should be difficulty-aware — some subjects suit a 6×6 easy
grid poorly. The prompt already carries difficulty instructions and the model
adapts vocabulary to it; if this proves insufficient in practice, adding
`difficulties?: Difficulty[]` to `SyllabusTopic` is a backwards-compatible
change. Not built now.
